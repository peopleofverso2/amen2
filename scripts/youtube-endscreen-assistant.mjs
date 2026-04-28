#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const usage = `YouTube End Screen Assistant (Playwright, assisted mode)

Usage:
  node scripts/youtube-endscreen-assistant.mjs --plan <plan.json> [--profile <dir>] [--headless]

Options:
  --plan <file>     Path to JSON file exported by the CMS YouTube dialog
  --profile <dir>   Chromium user profile directory (default: ./.playwright-youtube-profile)
  --headless        Run without visible browser (not recommended for manual setup)
  --help            Show this help
`;

const assistantRuntimeDir = path.resolve(
  process.env.AMEN_PLAYWRIGHT_ASSISTANT_HOME || path.join(os.homedir(), '.amen-playwright-assistant')
);

const parseArgs = (argv) => {
  const args = {
    planPath: '',
    profileDir: path.resolve(process.cwd(), '.playwright-youtube-profile'),
    headless: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    if (token === '--headless') {
      args.headless = true;
      continue;
    }
    if (token === '--plan') {
      args.planPath = String(argv[index + 1] || '').trim();
      index += 1;
      continue;
    }
    if (token === '--profile') {
      const profileRaw = String(argv[index + 1] || '').trim();
      if (profileRaw) {
        args.profileDir = path.resolve(process.cwd(), profileRaw);
      }
      index += 1;
      continue;
    }
  }

  return args;
};

const sanitizeYoutubeVideoId = (value) => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    return '';
  }
  const match = normalized.match(/^[a-zA-Z0-9_-]{6,20}$/);
  return match ? match[0] : '';
};

const extractYoutubeVideoId = (value) => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    return '';
  }

  const direct = sanitizeYoutubeVideoId(raw);
  if (direct) {
    return direct;
  }

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

    if (host === 'youtu.be') {
      const segment = parsed.pathname.split('/').filter(Boolean)[0] || '';
      return sanitizeYoutubeVideoId(segment);
    }

    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      const fromQuery = sanitizeYoutubeVideoId(parsed.searchParams.get('v') || '');
      if (fromQuery) {
        return fromQuery;
      }

      const pathSegments = parsed.pathname.split('/').filter(Boolean);
      if (pathSegments.length >= 2 && ['shorts', 'embed', 'live', 'v'].includes(pathSegments[0])) {
        return sanitizeYoutubeVideoId(pathSegments[1]);
      }
    }
  } catch {
    // Ignore parse errors and continue with regex fallback.
  }

  const fallback = raw.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/|v\/))([a-zA-Z0-9_-]{6,20})/
  );
  return fallback ? sanitizeYoutubeVideoId(fallback[1]) : '';
};

const buildYoutubeThumbnailUrl = (videoId) => {
  const sanitizedVideoId = sanitizeYoutubeVideoId(videoId);
  return sanitizedVideoId ? `https://i.ytimg.com/vi/${encodeURIComponent(sanitizedVideoId)}/hqdefault.jpg` : '';
};

const writeMinimalRuntimePackage = () => {
  fs.mkdirSync(assistantRuntimeDir, { recursive: true });
  const packagePath = path.join(assistantRuntimeDir, 'package.json');
  if (!fs.existsSync(packagePath)) {
    fs.writeFileSync(
      packagePath,
      JSON.stringify(
        {
          name: 'amen-playwright-assistant',
          private: true,
          version: '1.0.0',
        },
        null,
        2
      ),
      'utf8'
    );
  }
};

const runBootstrapCommand = (command, args, label) => {
  const result = spawnSync(command, args, {
    cwd: assistantRuntimeDir,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    throw new Error(`${label} impossible: ${result.error.message || result.error}`);
  }

  if (result.status !== 0) {
    throw new Error(`${label} a échoué (code ${result.status || 1})`);
  }
};

const loadPlaywrightFromDir = (baseDir) => {
  try {
    const requireFromBaseDir = createRequire(path.join(baseDir, 'package.json'));
    const playwright = requireFromBaseDir('playwright');
    return playwright?.chromium ? playwright : null;
  } catch {
    return null;
  }
};

const ensurePlaywrightRuntime = () => {
  const localPlaywright = loadPlaywrightFromDir(process.cwd());
  if (localPlaywright) {
    return localPlaywright;
  }

  const currentScriptPlaywright = (() => {
    try {
      const requireFromCurrentScript = createRequire(import.meta.url);
      const playwright = requireFromCurrentScript('playwright');
      return playwright?.chromium ? playwright : null;
    } catch {
      return null;
    }
  })();

  if (currentScriptPlaywright) {
    return currentScriptPlaywright;
  }

  writeMinimalRuntimePackage();
  let runtimePlaywright = loadPlaywrightFromDir(assistantRuntimeDir);

  if (!runtimePlaywright) {
    console.log(`Playwright absent. Installation automatique dans ${assistantRuntimeDir}...`);
    runBootstrapCommand('npm', ['install', 'playwright@latest'], 'Installation de Playwright');
    runtimePlaywright = loadPlaywrightFromDir(assistantRuntimeDir);
  }

  if (!runtimePlaywright) {
    throw new Error('Playwright reste introuvable après installation automatique.');
  }

  const browserMarkerPath = path.join(assistantRuntimeDir, '.chromium-installed');
  if (!fs.existsSync(browserMarkerPath)) {
    console.log('Installation du navigateur Chromium pour l assistant...');
    runBootstrapCommand('npx', ['playwright', 'install', 'chromium'], 'Installation de Chromium');
    fs.writeFileSync(browserMarkerPath, new Date().toISOString(), 'utf8');
  }

  return runtimePlaywright;
};

const normalizeStep = (step, index) => {
  const sourceStudioUrl = typeof step?.sourceStudioUrl === 'string' ? step.sourceStudioUrl.trim() : '';
  const sourceLabel =
    typeof step?.sourceLabel === 'string' && step.sourceLabel.trim()
      ? step.sourceLabel.trim()
      : `Source ${index + 1}`;
  const targets = Array.isArray(step?.targets)
    ? step.targets
        .map((target, targetIndex) => {
          const targetStudioUrl =
            typeof target?.targetStudioUrl === 'string' ? target.targetStudioUrl.trim() : '';
          const targetUrl = typeof target?.targetUrl === 'string' ? target.targetUrl.trim() : '';
          const targetVideoId =
            sanitizeYoutubeVideoId(target?.targetVideoId) ||
            extractYoutubeVideoId(targetUrl) ||
            extractYoutubeVideoId(targetStudioUrl);
          const providedTargetThumbnailUrl =
            typeof target?.targetThumbnailUrl === 'string' ? target.targetThumbnailUrl.trim() : '';
          return {
            targetLabel:
              typeof target?.targetLabel === 'string' && target.targetLabel.trim()
                ? target.targetLabel.trim()
                : `Target ${targetIndex + 1}`,
            targetVideoId,
            targetThumbnailUrl: providedTargetThumbnailUrl || buildYoutubeThumbnailUrl(targetVideoId),
            targetStudioUrl,
            targetUrl,
          };
        })
        .filter((target) => Boolean(target.targetStudioUrl || target.targetUrl))
    : [];

  if (!sourceStudioUrl || targets.length === 0) {
    return null;
  }

  return {
    sourceStudioUrl,
    sourceLabel,
    sourceVideoId:
      typeof step?.sourceVideoId === 'string' && step.sourceVideoId.trim()
        ? step.sourceVideoId.trim()
        : '',
    targets,
  };
};

const loadPlan = (planPath) => {
  const absolutePath = path.resolve(process.cwd(), planPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Plan file not found: ${absolutePath}`);
  }

  const raw = fs.readFileSync(absolutePath, 'utf8');
  const parsed = JSON.parse(raw);
  const steps = Array.isArray(parsed?.steps)
    ? parsed.steps
        .map((step, index) => normalizeStep(step, index))
        .filter(Boolean)
    : [];

  if (steps.length === 0) {
    throw new Error('Plan is valid JSON but contains no actionable steps.');
  }

  return {
    absolutePath,
    scenarioTitle:
      typeof parsed?.scenarioTitle === 'string' && parsed.scenarioTitle.trim()
        ? parsed.scenarioTitle.trim()
        : 'Interactive export',
    channelTitle:
      typeof parsed?.channelTitle === 'string' && parsed.channelTitle.trim()
        ? parsed.channelTitle.trim()
        : 'YouTube channel',
    steps,
  };
};

const bestEffortClick = async (page, selectors) => {
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      if ((await locator.count()) === 0) {
        continue;
      }
      await locator.click({ timeout: 1200 });
      await page.waitForTimeout(500);
      return true;
    } catch {
      // Best-effort only.
    }
  }
  return false;
};

const injectHelperPanel = async ({ page, step, index, total }) => {
  await page.evaluate(
    ({ payload, currentIndex, totalSteps }) => {
      const panelId = '__codex_youtube_endscreen_panel';
      let panel = document.getElementById(panelId);
      if (!panel) {
        panel = document.createElement('aside');
        panel.id = panelId;
        panel.style.position = 'fixed';
        panel.style.top = '16px';
        panel.style.right = '16px';
        panel.style.width = '380px';
        panel.style.maxHeight = '80vh';
        panel.style.overflow = 'auto';
        panel.style.zIndex = '2147483647';
        panel.style.background = 'rgba(7, 10, 16, 0.95)';
        panel.style.color = '#f7f9ff';
        panel.style.border = '1px solid rgba(116, 156, 255, 0.5)';
        panel.style.borderRadius = '12px';
        panel.style.padding = '12px';
        panel.style.fontFamily = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
        panel.style.fontSize = '13px';
        panel.style.lineHeight = '1.4';
        panel.style.boxShadow = '0 16px 40px rgba(0,0,0,0.45)';
        document.body.appendChild(panel);
      }

      panel.innerHTML = '';

      const title = document.createElement('div');
      title.textContent = `Playwright Assistant ${currentIndex}/${totalSteps}`;
      title.style.fontWeight = '700';
      title.style.marginBottom = '8px';
      panel.appendChild(title);

      const source = document.createElement('div');
      source.textContent = `Source: ${payload.sourceLabel}`;
      source.style.marginBottom = '8px';
      source.style.color = '#bcd3ff';
      panel.appendChild(source);

      const help = document.createElement('div');
      help.textContent =
        'In YouTube Studio Editor, add End screen elements of type Video and point each one to the targets below. Click a thumbnail card to open target video details.';
      help.style.marginBottom = '8px';
      help.style.color = '#d9e2ff';
      panel.appendChild(help);

      const cards = document.createElement('div');
      cards.style.display = 'grid';
      cards.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
      cards.style.gap = '8px';
      cards.style.marginBottom = '8px';

      payload.targets.forEach((target, targetIndex) => {
        const targetLink = target.targetStudioUrl || target.targetUrl || '';
        const card = document.createElement(targetLink ? 'a' : 'div');
        if (targetLink) {
          card.href = targetLink;
          card.target = '_blank';
          card.rel = 'noopener noreferrer';
        }
        card.style.display = 'block';
        card.style.textDecoration = 'none';
        card.style.border = '1px solid rgba(144, 171, 255, 0.35)';
        card.style.borderRadius = '10px';
        card.style.overflow = 'hidden';
        card.style.background = 'rgba(18, 24, 36, 0.95)';
        card.style.color = '#f7f9ff';
        card.style.minHeight = '96px';

        if (target.targetThumbnailUrl) {
          const image = document.createElement('img');
          image.src = target.targetThumbnailUrl;
          image.alt = target.targetLabel || `Target ${targetIndex + 1}`;
          image.loading = 'lazy';
          image.style.display = 'block';
          image.style.width = '100%';
          image.style.aspectRatio = '16 / 9';
          image.style.objectFit = 'cover';
          card.appendChild(image);
        } else {
          const placeholder = document.createElement('div');
          placeholder.style.width = '100%';
          placeholder.style.aspectRatio = '16 / 9';
          placeholder.style.background = 'linear-gradient(135deg, #1f2f56 0%, #3f5f9f 100%)';
          card.appendChild(placeholder);
        }

        const caption = document.createElement('div');
        caption.style.padding = '6px 8px';
        caption.style.display = 'flex';
        caption.style.flexDirection = 'column';
        caption.style.gap = '2px';

        const label = document.createElement('div');
        label.textContent = `${targetIndex + 1}. ${target.targetLabel || `Target ${targetIndex + 1}`}`;
        label.style.fontWeight = '600';
        label.style.fontSize = '12px';
        label.style.whiteSpace = 'nowrap';
        label.style.overflow = 'hidden';
        label.style.textOverflow = 'ellipsis';
        caption.appendChild(label);

        if (target.targetVideoId) {
          const id = document.createElement('div');
          id.textContent = target.targetVideoId;
          id.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
          id.style.fontSize = '11px';
          id.style.color = '#b7c2d8';
          id.style.whiteSpace = 'nowrap';
          id.style.overflow = 'hidden';
          id.style.textOverflow = 'ellipsis';
          caption.appendChild(id);
        }

        card.appendChild(caption);
        cards.appendChild(card);
      });

      panel.appendChild(cards);

      const list = document.createElement('ol');
      list.style.paddingLeft = '18px';
      list.style.margin = '0';

      payload.targets.forEach((target) => {
        const item = document.createElement('li');
        item.style.marginBottom = '8px';

        const label = document.createElement('div');
        label.textContent = target.targetLabel;
        label.style.fontWeight = '600';
        item.appendChild(label);

        if (target.targetVideoId) {
          const idLine = document.createElement('div');
          idLine.textContent = `Video ID: ${target.targetVideoId}`;
          idLine.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
          idLine.style.fontSize = '12px';
          idLine.style.color = '#b7c2d8';
          item.appendChild(idLine);
        }

        if (target.targetStudioUrl || target.targetUrl) {
          const link = document.createElement('a');
          link.href = target.targetStudioUrl || target.targetUrl;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = target.targetStudioUrl ? 'Open studio target' : 'Open video target';
          link.style.color = '#8ec8ff';
          link.style.textDecoration = 'underline';
          item.appendChild(link);
        }

        list.appendChild(item);
      });

      panel.appendChild(list);
    },
    {
      payload: step,
      currentIndex: index,
      totalSteps: total,
    }
  );
};

const run = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage);
    return;
  }
  if (!args.planPath) {
    console.error('Missing required argument: --plan <file.json>');
    console.error('Use --help for usage.');
    process.exitCode = 1;
    return;
  }

  const plan = loadPlan(args.planPath);

  let chromium;
  try {
    ({ chromium } = ensurePlaywrightRuntime());
  } catch (error) {
    console.error(error?.message || error);
    console.error(
      'Pré-requis minimal: Node.js/npm installés localement pour permettre l installation automatique de Playwright.'
    );
    process.exitCode = 1;
    return;
  }

  const rl = readline.createInterface({ input, output });
  let context;

  try {
    console.log(`Loaded plan: ${plan.absolutePath}`);
    console.log(`Scenario: ${plan.scenarioTitle}`);
    console.log(`Channel: ${plan.channelTitle}`);
    console.log(`Steps: ${plan.steps.length}`);
    console.log('');

    context = await chromium.launchPersistentContext(args.profileDir, {
      headless: args.headless,
      viewport: null,
    });

    const page = context.pages()[0] || (await context.newPage());
    await page.goto('https://studio.youtube.com/', { waitUntil: 'domcontentloaded' });

    await rl.question(
      'If needed, sign in to YouTube Studio in the opened browser, then press Enter to continue... '
    );

    for (let index = 0; index < plan.steps.length; index += 1) {
      const step = plan.steps[index];
      const stepNumber = index + 1;

      console.log(`\n[${stepNumber}/${plan.steps.length}] ${step.sourceLabel}`);
      console.log(`Source studio URL: ${step.sourceStudioUrl}`);
      step.targets.forEach((target, targetIndex) => {
        console.log(
          `  ${targetIndex + 1}. ${target.targetLabel}${
            target.targetVideoId ? ` (id: ${target.targetVideoId})` : ''
          }`
        );
      });

      await page.goto(step.sourceStudioUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      await injectHelperPanel({ page, step, index: stepNumber, total: plan.steps.length });

      await bestEffortClick(page, ['a:has-text("Editor")', 'a:has-text("Éditeur")']);
      await bestEffortClick(page, ['button:has-text("End screen")', 'button:has-text("Écran de fin")']);

      await rl.question(
        'Configure the end screen for this source, then press Enter to continue to the next one... '
      );
    }

    await rl.question('\nAll steps visited. Press Enter to close browser and exit... ');
  } finally {
    rl.close();
    if (context) {
      await context.close();
    }
  }
};

run().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
