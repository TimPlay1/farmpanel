// Test x2 mutations fix
const title = 'Brainrot - Swaggy bros 740M - x2 mutations';

// Simulate the cleanup
let cleanTitle = title
    .replace(/Unit\s*Price\s*:?\s*\$?[\d.,]+\s*[BbMm]?/gi, '')
    .replace(/\$(\d+[.,]?\d*)\s*M/gi, '$1M')
    .replace(/\$(\d+[.,]?\d*)\s*B/gi, '$1B')
    .replace(/\s*[-–—]\s*x\d+\s*(mutation|mutations|mut)?\s*/gi, ' ')
    .replace(/\s*x\d+\s*(mutation|mutations|mut)\s*/gi, ' ')
    .replace(/\s*\d+x\s*(mutation|mutations|mut)\s*/gi, ' ');

console.log('Original:', title);
console.log('Clean:', cleanTitle);

// Test M pattern match
const mPattern = /(\d+[.,]?\d*)\s*M\/s/i;
const mPatternNoSlash = /(\d+[.,]?\d*)\s*M(?:\s|$|[^a-zA-Z\/])/i;

console.log('Match M/s:', cleanTitle.match(mPattern));
console.log('Match M:', cleanTitle.match(mPatternNoSlash));

// Test range patterns DON'T match
const rangePatterns = [
    /(\d+)\s*[mM]?\s*[-~]\s*(\d+)\s*[mM]\/[sS]/i,
    /(\d+)\s*[mM]?\s+to\s+(\d+)\s*[mM]\/[sS]/i,
    /(\d+)\s*[mM]?\s*[-~]\s*(\d+)\s*[mM]\s/i,
];

console.log('\nRange pattern tests (should all be null after cleanup):');
rangePatterns.forEach((p, i) => console.log(i, p.test(cleanTitle), cleanTitle.match(p)));
