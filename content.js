(function() {
  'use strict';

  const cleanGeminiCitations = () => {
    // Target both the raw code blocks and the container for broader coverage
    const codeBlocks = document.querySelectorAll('code[data-test-id="code-content"], pre');
    codeBlocks.forEach(block => {
      // 1. Remove [cite_start] and [cite_end] style
      removeComplexPattern(block, /\[\s*cite_start\s*\]|\[\s*cite_end\s*\]/gi);
      
      // 2. Remove style
      removeComplexPattern(block, /\[\s*cite:\s*[^\]]+\]/gi);
      
      // 3. Cleanup empty comment tags left behind
      removeEmptyCommentSpans(block);
      
      block.normalize();
    });
  };

  /**
   * Finds text across multiple DOM nodes and removes the range.
   * Computes all ranges on the unmodified tree first, then deletes backwards
   * so that indices remain valid.
   */
  const removeComplexPattern = (root, regex) => {
    const fullText = root.textContent;
    const matches = [];
    let match;
    while ((match = regex.exec(fullText)) !== null) {
      matches.push({ start: match.index, end: match.index + match[0].length });
    }
    if (matches.length === 0) return;

    // Map all match indices to DOM ranges while the tree is still unmodified
    const ranges = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    let currentPos = 0;
    const textNodes = [];
    let node;
    while ((node = walker.nextNode()) !== null) {
      textNodes.push({ node, start: currentPos, end: currentPos + node.nodeValue.length });
      currentPos += node.nodeValue.length;
    }

    for (const { start, end } of matches) {
      let startNode, startOffset, endNode, endOffset;
      for (const { node: n, start: s, end: e } of textNodes) {
        if (startNode === undefined && s + n.nodeValue.length > start) {
          startNode = n;
          startOffset = start - s;
        }
        if (endNode === undefined && s + n.nodeValue.length >= end) {
          endNode = n;
          endOffset = end - s;
          break;
        }
      }
      if (startNode && endNode) {
        ranges.push({ startNode, startOffset, endNode, endOffset });
      }
    }

    // Delete from last to first so earlier ranges stay valid
    for (let i = ranges.length - 1; i >= 0; i--) {
      const { startNode, startOffset, endNode, endOffset } = ranges[i];
      const range = document.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      range.deleteContents();
    }
  };

  const removeEmptyCommentSpans = (root) => {
    // Remove spans that only contain slashes or whitespace after the text was deleted
    const commentSpans = root.querySelectorAll('span[class*="comment"], span[class*="meta"]');
    commentSpans.forEach(span => {
      if (/^[\/\s]*$/.test(span.textContent)) {
        span.remove();
      }
    });
  };

  let isCleaning = false;
  const observer = new MutationObserver((mutations) => {
    if (isCleaning) return;
    
    // Check if any mutation actually added nodes to avoid infinite loops
    const hasAddedNodes = mutations.some(m => m.addedNodes.length > 0 || m.type === 'characterData');
    if (!hasAddedNodes) return;

    isCleaning = true;
    cleanGeminiCitations();
    setTimeout(() => { isCleaning = false; }, 200);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });

  // Initial Clean
  setTimeout(cleanGeminiCitations, 500);
})();