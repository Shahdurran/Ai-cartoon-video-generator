const fs = require('fs-extra');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const path = require('path');
const tar = require('tar');

/**
 * Extract Google Drive file ID from various URL formats
 */
function extractGoogleDriveFileId(url) {
  // Handle different Google Drive URL formats
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9-_]+)/,  // /file/d/FILE_ID
    /id=([a-zA-Z0-9-_]+)/,          // id=FILE_ID
    /\/d\/([a-zA-Z0-9-_]+)/,        // /d/FILE_ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Convert Google Drive sharing URL to direct download URL
 */
function convertGoogleDriveUrl(url) {
  if (!url.includes('drive.google.com')) {
    return url; // Not a Google Drive URL
  }

  const fileId = extractGoogleDriveFileId(url);
  if (!fileId) {
    throw new Error('Could not extract file ID from Google Drive URL');
  }

  console.log(`Google Drive URL detected, converting to direct download link...`);
  console.log(`Extracted file ID: ${fileId}`);
  
  // Use the direct download format
  const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
  console.log(`Direct Google Drive link created: ${directUrl}`);
  
  return directUrl;
}

/**
 * Handle Google Drive virus scan warning and get actual download URL
 */
async function handleGoogleDriveDownload(url, outputPath, maxRetries = 3) {
  const fileId = extractGoogleDriveFileId(url);
  if (!fileId) {
    throw new Error('Could not extract file ID from Google Drive URL');
  }

  console.log(`🔄 Handling Google Drive download for file ID: ${fileId}`);
  
  // Try multiple Google Drive download methods
  const downloadMethods = [
    // Method 1: Direct download with confirm parameter
    `https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`,
    // Method 2: Direct download without confirm
    `https://drive.google.com/uc?export=download&id=${fileId}`,
    // Method 3: Alternative direct download format
    `https://docs.google.com/uc?export=download&id=${fileId}`,
    // Method 4: With additional parameters
    `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t&ts=1`
  ];

  for (let i = 0; i < downloadMethods.length; i++) {
    const downloadUrl = downloadMethods[i];
    console.log(`🔍 Trying Google Drive download method ${i + 1}: ${downloadUrl}`);
    
    try {
      // First, try to get the actual download URL by following redirects
      const actualDownloadUrl = await getRedirectUrl(downloadUrl);
      console.log(`✅ Got redirect URL: ${actualDownloadUrl}`);
      
      // Now download the actual file
      await downloadFileFromUrl(actualDownloadUrl, outputPath);
      console.log(`✅ Successfully downloaded Google Drive file using method ${i + 1}`);
      return;
      
    } catch (error) {
      console.log(`⚠️ Method ${i + 1} failed: ${error.message}`);
      
      // If this is the last method, throw the error
      if (i === downloadMethods.length - 1) {
        throw new Error(`All Google Drive download methods failed. Last error: ${error.message}`);
      }
    }
  }
}

/**
 * Get the final redirect URL from a Google Drive link
 */
async function getRedirectUrl(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    };

    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const req = protocol.request(options, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        console.log(`🔄 Following redirect to: ${res.headers.location}`);
        resolve(res.headers.location);
      } else if (res.statusCode === 200) {
        // If we get a 200, this might be the actual file or a page with download link
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          // Check if this is HTML content (virus scan warning)
          if (data.includes('<html>') || data.includes('<!DOCTYPE')) {
            console.log('📄 Received HTML response, parsing for download link...');
            
            // Try to extract download link from HTML
            const downloadLinkMatch = data.match(/href="([^"]*uc[^"]*export=download[^"]*)"/);
            if (downloadLinkMatch) {
              const extractedUrl = downloadLinkMatch[1];
              console.log(`🔗 Extracted download link from HTML: ${extractedUrl}`);
              resolve(extractedUrl);
            } else {
              reject(new Error('Could not find download link in Google Drive HTML response'));
            }
          } else {
            // This might be the actual file content
            resolve(url);
          }
        });
      } else {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
      }
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Download file from a direct URL
 */
async function downloadFileFromUrl(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    };

    const protocol = urlObj.protocol === 'https:' ? https : http;
    const req = protocol.request(options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      res.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
    });

    req.on('error', (error) => {
      fs.unlink(outputPath, () => {}); // Delete partial file
      reject(error);
    });

    req.setTimeout(30000, () => {
      req.destroy();
      fs.unlink(outputPath, () => {}); // Delete partial file
      reject(new Error('Download timeout'));
    });

    req.end();
  });
}

/**
 * Handle other common file hosting services
 */
async function handleOtherFileHosts(url, outputPath) {
  const urlLower = url.toLowerCase();
  
  // Handle Dropbox links
  if (url.includes('dropbox.com')) {
    // Convert Dropbox sharing links to direct download
    if (url.includes('?dl=0')) {
      url = url.replace('?dl=0', '?dl=1');
    } else if (!url.includes('?dl=1')) {
      url += (url.includes('?') ? '&' : '?') + 'dl=1';
    }
    console.log(`🔄 Converted Dropbox URL to direct download: ${url}`);
  }
  
  // Handle OneDrive links
  if (url.includes('onedrive.live.com') || url.includes('1drv.ms')) {
    // OneDrive links need special handling
    console.log('🔄 OneDrive link detected - may require manual download');
  }
  
  // Handle Box links
  if (url.includes('box.com')) {
    // Convert Box sharing links to direct download
    if (url.includes('/s/')) {
      url = url.replace('/s/', '/d/');
    }
    console.log(`🔄 Converted Box URL to direct download: ${url}`);
  }
  
  return url;
}

/**
 * Enhanced function to extract download links from Google Drive HTML
 */
function extractDownloadLinkFromHtml(html, fileId) {
  console.log('Analyzing Google Drive HTML response...');
  
  // Multiple patterns to find download links
  const patterns = [
    // Direct download confirmation link
    new RegExp(`/uc\\?export=download&amp;confirm=([^&"]+)&amp;id=${fileId}`, 'i'),
    // Alternative confirmation pattern
    /href="([^"]*&amp;confirm=[^"]*&amp;id=[^"]*)"/i,
    // Direct export link
    new RegExp(`/uc\\?export=download&amp;id=${fileId}[^"]*`, 'i'),
    // Form action for large files
    /<form[^>]*action="([^"]*uc\?[^"]*export=download[^"]*)"[^>]*>/i,
    // JavaScript download link
    /window\.location\.href\s*=\s*["']([^"']*uc\?[^"']*export=download[^"']*)/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      let downloadUrl = match[1] || match[0];
      
      // Clean up the URL
      downloadUrl = downloadUrl.replace(/&amp;/g, '&');
      
      // Ensure it's a complete URL
      if (downloadUrl.startsWith('/')) {
        downloadUrl = `https://drive.google.com${downloadUrl}`;
      } else if (!downloadUrl.startsWith('http')) {
        downloadUrl = `https://drive.google.com/uc?${downloadUrl}`;
      }
      
      console.log(`Found download link: ${downloadUrl}`);
      return downloadUrl;
    }
  }

  // Look for virus scan bypass
  const virusScanMatch = html.match(/href="([^"]*&amp;confirm=t[^"]*)"/i);
  if (virusScanMatch) {
    const downloadUrl = virusScanMatch[1].replace(/&amp;/g, '&');
    console.log(`Found virus scan bypass link: ${downloadUrl}`);
    return `https://drive.google.com${downloadUrl}`;
  }

  return null;
}

/**
 * Extract .mp3 file from a tar archive
 */
async function extractMp3FromTar(tarPath, extractDir) {
  try {
    console.log(`Extracting tar file: ${tarPath}`);
    
    // Ensure extraction directory exists
    await fs.ensureDir(extractDir);
    
    // Extract the tar file
    await tar.extract({
      file: tarPath,
      cwd: extractDir,
      strip: 0 // Keep directory structure
    });
    
    console.log('Tar extraction completed');
    
    // Find .mp3 file in extracted contents
    const findMp3Files = async (dir) => {
      const items = await fs.readdir(dir);
      const mp3Files = [];
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = await fs.stat(fullPath);
        
        if (stat.isDirectory()) {
          // Recursively search subdirectories
          const subMp3Files = await findMp3Files(fullPath);
          mp3Files.push(...subMp3Files);
        } else if (path.extname(item).toLowerCase() === '.mp3') {
          mp3Files.push(fullPath);
        }
      }
      
      return mp3Files;
    };
    
    const mp3Files = await findMp3Files(extractDir);
    
    if (mp3Files.length === 0) {
      throw new Error('No .mp3 file found in the tar archive');
    }
    
    if (mp3Files.length > 1) {
      console.log(`Found multiple .mp3 files: ${mp3Files.join(', ')}`);
      console.log('Using the first one found');
    }
    
    const mp3Path = mp3Files[0];
    console.log(`Found .mp3 file: ${mp3Path}`);
    
    // Verify the file exists and has content
    const stats = await fs.stat(mp3Path);
    if (stats.size === 0) {
      throw new Error('Extracted .mp3 file is empty');
    }
    
    console.log(`Extracted .mp3 file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    
    // Clean up the tar file
    await fs.remove(tarPath);
    console.log('Cleaned up tar file');
    
    return mp3Path;
    
  } catch (error) {
    console.error('Error extracting tar file:', error);
    throw new Error(`Failed to extract .mp3 from tar: ${error.message}`);
  }
}

/**
 * Download file with enhanced Google Drive handling and tar extraction
 */
function downloadFile(url, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log(`Starting download: ${url} -> ${outputPath}`);
      
      // Check if the URL suggests a tar file
      const urlLower = url.toLowerCase();
      const isCompressedFile = urlLower.includes('.tar') || path.extname(url).toLowerCase() === '.tar';
      
      // Handle Google Drive URLs with enhanced method
      if (url.includes('drive.google.com')) {
        try {
          console.log('🔄 Using enhanced Google Drive download method...');
          await handleGoogleDriveDownload(url, outputPath);
          console.log('✅ Google Drive download completed successfully');
          resolve();
          return;
        } catch (error) {
          console.log(`⚠️ Enhanced Google Drive method failed: ${error.message}`);
          console.log('🔄 Falling back to standard Google Drive handling...');
        }
      }
      
      // Handle other file hosting services
      if (url.includes('dropbox.com') || url.includes('onedrive.live.com') || url.includes('1drv.ms') || url.includes('box.com')) {
        try {
          console.log('🔄 Handling other file hosting service...');
          const convertedUrl = await handleOtherFileHosts(url, outputPath);
          url = convertedUrl; // Update the URL for further processing
        } catch (error) {
          console.log(`⚠️ File hosting service handling failed: ${error.message}`);
        }
      }
      
      // Convert Google Drive URLs to direct download format (fallback)
      let downloadUrl = url;
      let isGoogleDrive = false;
      let fileId = null;
      
      if (url.includes('drive.google.com')) {
        try {
          fileId = extractGoogleDriveFileId(url);
          downloadUrl = convertGoogleDriveUrl(url);
          isGoogleDrive = true;
        } catch (error) {
          console.error('Error converting Google Drive URL:', error.message);
          return reject(error);
        }
      }

      let attemptCount = 0;
      const maxAttempts = 5; // Increased for Google Drive
      let sessionCookies = '';
      
      const attemptDownload = (currentUrl, cookies = '') => {
        attemptCount++;
        console.log(`Download attempt ${attemptCount}/${maxAttempts} for ${currentUrl}`);
        
        if (attemptCount > maxAttempts) {
          return reject(new Error('Maximum download attempts exceeded'));
        }
        
        const urlObj = new URL(currentUrl);
        const client = urlObj.protocol === 'https:' ? https : http;
        
        const options = {
          hostname: urlObj.hostname,
          port: urlObj.port,
          path: urlObj.pathname + urlObj.search,
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Upgrade-Insecure-Requests': '1',
          }
        };
        
        if (cookies || sessionCookies) {
          options.headers['Cookie'] = cookies || sessionCookies;
        }

        const req = client.request(options, (res) => {
          console.log(`Response status: ${res.statusCode}`);
          console.log(`Content-Type: ${res.headers['content-type']}`);

          // Handle cookies for session management
          if (res.headers['set-cookie']) {
            const newCookies = res.headers['set-cookie']
              .map(cookie => cookie.split(';')[0])
              .join('; ');
            sessionCookies = sessionCookies ? `${sessionCookies}; ${newCookies}` : newCookies;
            console.log('Updated session cookies');
          }

          // Handle redirects
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            console.log(`Redirecting to: ${res.headers.location}`);
            return attemptDownload(res.headers.location, sessionCookies);
          }

          // Check for error responses
          if (res.statusCode !== 200) {
            return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }

          // Handle Google Drive specific responses
          if (isGoogleDrive) {
            const contentType = res.headers['content-type'] || '';
            const contentLength = parseInt(res.headers['content-length']) || 0;
            
            // If we get HTML, we need to parse it for download links
            if (contentType.includes('text/html')) {
              console.log('Received HTML response from Google Drive, parsing for download link...');
              
              let htmlData = '';
              res.on('data', chunk => htmlData += chunk.toString());
              res.on('end', () => {
                try {
                  // Try to extract download link from HTML
                  const downloadLink = extractDownloadLinkFromHtml(htmlData, fileId);
                  
                  if (downloadLink) {
                    console.log('Found download link in HTML, retrying...');
                    return attemptDownload(downloadLink, sessionCookies);
                  }
                  
                  // Check if it's a quota exceeded error
                  if (htmlData.includes('quota exceeded') || htmlData.includes('too many users')) {
                    return reject(new Error('Google Drive quota exceeded. Please try again later or use a different file hosting service.'));
                  }
                  
                  // Check if file is too large
                  if (htmlData.includes('too large') || htmlData.includes('cannot scan')) {
                    console.log('Large file detected, trying alternative approach...');
                    
                    // Try with confirm parameter for large files
                    const largeFileUrl = `https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`;
                    return attemptDownload(largeFileUrl, sessionCookies);
                  }
                  
                  // Log HTML for debugging
                  console.log('HTML response (first 500 chars):', htmlData.substring(0, 500));
                  reject(new Error('Could not find download link in Google Drive response. File may require manual download or different sharing settings.'));
                  
                } catch (parseError) {
                  console.error('Error parsing Google Drive HTML:', parseError);
                  reject(new Error('Failed to parse Google Drive response'));
                }
              });
              
              res.on('error', (error) => {
                console.error('Error reading HTML response:', error);
                reject(error);
              });
              
              return; // Don't continue with file download
            }
            
            // If content length is very small for an expected media file, it might be an error
            if (contentLength > 0 && contentLength < 1000) {
              console.warn(`Suspiciously small file size: ${contentLength} bytes`);
            }
          }

          // At this point, we should have a proper file response
          console.log('Starting file download...');
          
          // Determine the actual download path
          let actualOutputPath = outputPath;
          if (isCompressedFile) {
            // For compressed files, download to a temporary .tar location first
            const outputDir = path.dirname(outputPath);
            const tarFileName = `temp_${Date.now()}.tar`;
            actualOutputPath = path.join(outputDir, tarFileName);
            console.log(`Downloading compressed file to: ${actualOutputPath}`);
          }
          
          const fileStream = fs.createWriteStream(actualOutputPath);
          let downloadedBytes = 0;
          const totalBytes = parseInt(res.headers['content-length']) || 0;
          
          if (totalBytes > 0) {
            console.log(`Expected file size: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
          }

          res.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            if (totalBytes > 0) {
              const progress = ((downloadedBytes / totalBytes) * 100).toFixed(1);
              process.stdout.write(`\rDownload progress: ${progress}%`);
            } else {
              process.stdout.write(`\rDownloaded: ${(downloadedBytes / 1024 / 1024).toFixed(2)} MB`);
            }
          });

          res.on('end', async () => {
            console.log(`\nDownload completed. Total bytes: ${downloadedBytes}`);
            
            // Verify file was actually written
            if (!fs.existsSync(actualOutputPath)) {
              return reject(new Error('File was not created'));
            }
            
            const actualSize = fs.statSync(actualOutputPath).size;
            if (actualSize === 0) {
              return reject(new Error('Downloaded file is empty'));
            }
            
            // For Google Drive, check if we accidentally downloaded HTML
            if (isGoogleDrive && actualSize < 10000) {
              const fileContent = fs.readFileSync(actualOutputPath, 'utf8');
              if (fileContent.includes('<!DOCTYPE html>') || fileContent.includes('<html')) {
                fs.removeSync(actualOutputPath);
                return reject(new Error('Downloaded HTML instead of file. This may be due to Google Drive restrictions or file sharing settings.'));
              }
            }
            
            try {
              if (isCompressedFile) {
                console.log('Processing compressed file...');
                
                // Extract the tar and find .mp3 file
                const extractDir = path.join(path.dirname(outputPath), `extracted_${Date.now()}`);
                const mp3Path = await extractMp3FromTar(actualOutputPath, extractDir);
                
                // Move the extracted .mp3 to the desired output path
                await fs.move(mp3Path, outputPath);
                console.log(`Moved extracted .mp3 to: ${outputPath}`);
                
                // Clean up extraction directory
                await fs.remove(extractDir);
                console.log('Cleaned up extraction directory');
                
                const finalStats = fs.statSync(outputPath);
                console.log(`Successfully processed compressed file. Final .mp3 size: ${(finalStats.size / 1024 / 1024).toFixed(2)} MB`);
              } else {
                console.log(`Successfully downloaded to ${outputPath} (${(actualSize / 1024 / 1024).toFixed(2)} MB)`);
              }
              
              resolve();
            } catch (extractError) {
              console.error('Error processing compressed file:', extractError);
              // Clean up any remaining files
              if (fs.existsSync(actualOutputPath)) {
                fs.removeSync(actualOutputPath);
              }
              reject(extractError);
            }
          });

          res.on('error', (error) => {
            console.error('Response error:', error);
            fileStream.destroy();
            if (fs.existsSync(actualOutputPath)) {
              fs.removeSync(actualOutputPath);
            }
            reject(error);
          });

          res.pipe(fileStream);

          fileStream.on('error', (error) => {
            console.error('File stream error:', error);
            if (fs.existsSync(actualOutputPath)) {
              fs.removeSync(actualOutputPath);
            }
            reject(error);
          });
        });

        req.on('error', (error) => {
          console.error('Request error:', error);
          
          // Check if this is a retryable error
          const retryableErrors = ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'];
          const isRetryable = retryableErrors.includes(error.code) || 
                              error.message.includes('socket hang up') ||
                              error.message.includes('timeout');
          
          if (isRetryable && attemptCount < maxAttempts) {
            console.log(`🔄 Retryable error detected, will retry: ${error.message}`);
            // Wait before retry
            setTimeout(() => {
              attemptDownload(currentUrl, sessionCookies);
            }, 2000 * attemptCount); // Exponential backoff
          } else {
            reject(error);
          }
        });

        req.setTimeout(120000, () => { // Increased timeout for large files
          req.destroy();
          
          if (attemptCount < maxAttempts) {
            console.log(`🔄 Download timeout, retrying in ${2000 * attemptCount}ms...`);
            setTimeout(() => {
              attemptDownload(currentUrl, sessionCookies);
            }, 2000 * attemptCount); // Exponential backoff
          } else {
            reject(new Error('Download timeout (2 minutes) - all retries exhausted'));
          }
        });

        req.end();
      };

      // Start the download
      attemptDownload(downloadUrl);

    } catch (error) {
      console.error('Download setup error:', error);
      reject(error);
    }
  });
}

module.exports = downloadFile;