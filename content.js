(function() {
  'use strict';

  // ----- Main cleaning function -----
  const cleanGeminiCitations = () => {
    const codeBlocks = document.querySelectorAll('code[data-test-id="code-content"]');
    codeBlocks.forEach(block => {
      removeCiteStartEndSpans(block);      // Step 1: [cite_start] and [cite_end]
      removeCiteColonPatterns(block);      // Step 2: [cite: …]
      removeEmptyCommentSpans(block);      // Step 3: empty // comments
      block.normalize();                   // Merge adjacent text nodes
    });
  };

  // ----- Step 1: Remove <span class="hljs-meta">cite_start</span> and cite_end with their brackets -----
  const removeCiteStartEndSpans = (root) => {
    const metaSpans = root.querySelectorAll('span.hljs-meta');
    metaSpans.forEach(span => {
      const text = span.textContent.trim();
      if (text === 'cite_start' || text === 'cite_end') {
        // Remove previous sibling if it's a text node containing only '['
        const prev = span.previousSibling;
        if (prev && prev.nodeType === Node.TEXT_NODE && prev.nodeValue.trim() === '[') {
          prev.remove();
        }
        // Remove next sibling if it's a text node containing only ']'
        const next = span.nextSibling;
        if (next && next.nodeType === Node.TEXT_NODE && next.nodeValue.trim() === ']') {
          next.remove();
        }
        // Remove the span itself
        span.remove();
      }
    });
  };

  // ----- Step 2: Remove [cite: …] patterns, even when split across multiple elements -----
  const removeCiteColonPatterns = (root) => {
    let changed;
    do {
      changed = false;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const text = node.nodeValue;
        const lower = text.toLowerCase();
        const citePos = lower.indexOf('[cite:');
        if (citePos === -1) continue;

        // Start of the citation (the '[' character)
        const startOffset = citePos;

        // Look for closing ']' in the same node
        let endNode = node;
        let endOffset = text.indexOf(']', citePos);
        if (endOffset !== -1) {
          // Found closing bracket in the same node
          endOffset += 1; // position after the ']'
        } else {
          // Need to walk forward to find the closing ']'
          let found = false;
          let nextNode = node;
          while ((nextNode = getNextNode(nextNode, root))) {
            if (nextNode.nodeType === Node.TEXT_NODE) {
              const idx = nextNode.nodeValue.indexOf(']');
              if (idx !== -1) {
                endNode = nextNode;
                endOffset = idx + 1; // after the ']'
                found = true;
                break;
              }
            }
          }
          if (!found) continue; // malformed citation – skip
        }

        // Delete the exact range from start bracket to closing bracket
        const range = document.createRange();
        range.setStart(node, startOffset);
        range.setEnd(endNode, endOffset);
        range.deleteContents();
        changed = true;
        break; // DOM changed – restart scan
      }
    } while (changed);
  };

  // Helper: returns the next node in depth‑first order within the given root
  const getNextNode = (node, root) => {
    if (node.firstChild) return node.firstChild;
    while (node) {
      if (node.nextSibling) return node.nextSibling;
      node = node.parentNode;
      if (node === root) return null;
    }
    return null;
  };

  // ----- Step 3: Remove empty comment spans (e.g., <span class="hljs-comment">// </span>) -----
  const removeEmptyCommentSpans = (root) => {
    const commentSpans = root.querySelectorAll('span.hljs-comment');
    commentSpans.forEach(span => {
      const text = span.textContent;
      // Remove if the comment consists only of '//' and optional whitespace (and nothing else)
      if (/^\/\/\s*$/.test(text)) {
        span.remove();
      }
    });
  };

  // ----- Observer to clean dynamically loaded content -----
  let isCleaning = false;
  const observer = new MutationObserver(() => {
    if (isCleaning) return;
    isCleaning = true;
    cleanGeminiCitations();
    setTimeout(() => { isCleaning = false; }, 100);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });

  // Initial clean
  cleanGeminiCitations();
})();