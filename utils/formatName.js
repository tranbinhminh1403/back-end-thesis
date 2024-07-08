// formatName.js

// Function to process product names
const processName = (name) => {
    // Regular expression to match CPU details like "R5 7530U", "i3 1215U", "i3-N305", "R7 3700X"
    const cpuPattern = /\b(?:[Rr]\d{1,2}|[Ii]\d{1,2})[- ]?[A-Za-z]?\d{3,4}\d{1,2}[A-Za-z]?[A-Za-z]?\b/g;


    return name
        .replace(/máy tính xách tay|máy tính|gaming|laptop/gi, '') // Remove specified phrases
        .replace(/\(.*?\)/g, '') // Remove content inside brackets
        .replace(cpuPattern, '') // Remove CPU details
        .trim(); // Trim any extra spaces
};

module.exports = { processName };
