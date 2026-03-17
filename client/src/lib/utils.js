/**
 * Formats a file size in bytes to a human-readable string.
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Formats a date string to a locale-friendly display.
 */
export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Truncates text to a specified length.
 */
export function truncateText(text, maxLen = 100) {
  if (!text || text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + '…';
}

/**
 * Generates a unique ID for client-side use.
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/**
 * Splits text into chunks of specified size while trying to preserve sentence boundaries.
 * This improves embedding quality and AI response speed for large documents.
 *
 * @param {string} text - The text to split into chunks
 * @param {number} chunkSize - Target chunk size in characters (default: 600)
 * @param {number} overlap - Number of characters to overlap between chunks (default: 100)
 * @returns {string[]} Array of text chunks
 */
export function chunkText(text, chunkSize = 600, overlap = 100) {
  if (!text || typeof text !== 'string') return [];

  const cleanText = text.trim();
  if (cleanText.length <= chunkSize) {
    return [cleanText];
  }

  const chunks = [];
  let startIndex = 0;

  while (startIndex < cleanText.length) {
    let endIndex = Math.min(startIndex + chunkSize, cleanText.length);

    // Try to find a sentence boundary (., !, ?) near the end of the chunk
    if (endIndex < cleanText.length) {
      const searchStart = Math.max(startIndex + Math.floor(chunkSize * 0.7), startIndex);
      const segment = cleanText.slice(searchStart, endIndex);

      // Look for sentence endings
      const sentenceEnders = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];
      let lastSentenceEnd = -1;

      for (const ender of sentenceEnders) {
        const pos = segment.lastIndexOf(ender);
        if (pos > lastSentenceEnd) {
          lastSentenceEnd = pos;
        }
      }

      if (lastSentenceEnd > 0) {
        endIndex = searchStart + lastSentenceEnd + 2; // Include the punctuation and space
      } else {
        // Fallback: try to break at a word boundary
        const lastSpace = segment.lastIndexOf(' ');
        if (lastSpace > 0) {
          endIndex = searchStart + lastSpace;
        }
      }
    }

    const chunk = cleanText.slice(startIndex, endIndex).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // Move start index, accounting for overlap
    startIndex = endIndex - overlap;
    if (startIndex >= cleanText.length - overlap) {
      break; // Prevent tiny final chunks
    }
  }

  return chunks;
}

/**
 * Processes slide content for large documents by chunking each slide's text.
 * Returns an array of processed slides with chunked content.
 *
 * @param {Array} slides - Array of slide objects with text content
 * @param {number} chunkSize - Target chunk size (default: 600)
 * @returns {Array} Array of slide chunks with metadata
 */
export function processSlideContent(slides, chunkSize = 600) {
  if (!Array.isArray(slides)) return [];

  const processedChunks = [];

  for (const slide of slides) {
    const slideText = slide.text || slide.content || '';
    const slideNumber = slide.slideNumber || slide.index || slides.indexOf(slide) + 1;
    const heading = slide.heading || slide.title || '';

    if (slideText.length <= chunkSize) {
      // Slide is small enough, keep as-is
      processedChunks.push({
        slideNumber,
        heading,
        text: slideText,
        isChunked: false,
        chunkIndex: 0,
        totalChunks: 1,
      });
    } else {
      // Chunk the slide text
      const chunks = chunkText(slideText, chunkSize, 50);
      chunks.forEach((chunk, idx) => {
        processedChunks.push({
          slideNumber,
          heading,
          text: chunk,
          isChunked: true,
          chunkIndex: idx,
          totalChunks: chunks.length,
        });
      });
    }
  }

  return processedChunks;
}

/**
 * Estimates if a document is "large" based on total character count.
 * @param {Array} slides - Array of slide objects
 * @param {number} threshold - Character threshold for "large" documents (default: 10000)
 * @returns {boolean}
 */
export function isLargeDocument(slides, threshold = 10000) {
  if (!Array.isArray(slides)) return false;

  const totalChars = slides.reduce((sum, slide) => {
    const text = slide.text || slide.content || '';
    return sum + text.length;
  }, 0);

  return totalChars > threshold;
}
