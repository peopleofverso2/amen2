import { describe, it } from 'vitest';
import { expect } from 'vitest';
import { LocalStorageAdapter } from '../services/storage/LocalStorageAdapter';
import { MediaMetadata } from '../types/media';

describe('LocalStorageAdapter', () => {
  it('should handle media operations correctly', async () => {
    const adapter = LocalStorageAdapter.getInstance();
    
    // Test 1: Save and retrieve a media file
    console.log('\nTest 1: Save and retrieve media');
    
    // Create a test video file
    const videoBlob = new Blob(['test video content'], { type: 'video/mp4' });
    const videoFile = new File([videoBlob], 'test-video.mp4', { type: 'video/mp4' });
    
    const metadata: Partial<MediaMetadata> = {
      name: 'Test Video',
      tags: ['test']
    };
    
    // Save the media file
    console.log('Saving media file...');
    const savedMedia = await adapter.saveMedia(videoFile, metadata);
    console.log('Media saved:', savedMedia.id);
    
    // Retrieve the media file
    console.log('Retrieving media file...');
    const retrievedMedia = await adapter.getMedia(savedMedia.id);
    console.log('Media retrieved:', retrievedMedia.id);
    
    expect(retrievedMedia.id).toBe(savedMedia.id);
    expect(retrievedMedia.metadata.name).toBe(metadata.name);
    
    // Verify URLs are cached and reused
    console.log('Testing URL caching...');
    const retrievedAgain = await adapter.getMedia(savedMedia.id);
    
    expect(retrievedMedia.url).toBe(retrievedAgain.url);
    expect(retrievedMedia.thumbnailUrl).toBe(retrievedAgain.thumbnailUrl);
    
    console.log('URLs match:', {
      original: savedMedia.url === retrievedMedia.url,
      cached: retrievedMedia.url === retrievedAgain.url
    });
    
    // Test 2: Delete media and verify cleanup
    console.log('\nTest 2: Delete media and verify cleanup');
    await adapter.deleteMedia(savedMedia.id);
    
    // Try to fetch deleted media (should fail)
    await expect(adapter.getMedia(savedMedia.id)).rejects.toThrow();
    console.log('Successfully verified media deletion');
    
    // Test 3: Save multiple media files
    console.log('\nTest 3: Save multiple media files');
    const promises = [];
    for (let i = 0; i < 3; i++) {
      const file = new File([`test content ${i}`], `test-${i}.mp4`, { type: 'video/mp4' });
      promises.push(adapter.saveMedia(file, { name: `Test ${i}` }));
    }
    
    const savedFiles = await Promise.all(promises);
    expect(savedFiles).toHaveLength(3);
    console.log(`Successfully saved ${savedFiles.length} files`);
    
    // List all media files
    const allMedia = await adapter.listMedia();
    expect(allMedia).toHaveLength(3);
    console.log(`Total media files in storage: ${allMedia.length}`);
    
    console.log('\nAll tests completed successfully!');
  });
});
