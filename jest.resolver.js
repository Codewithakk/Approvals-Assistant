const path = require("path");

/**
 * Custom Jest resolver that bypasses the Windows moduleNameMapper $1 bug.
 * Receives the raw "@/..." request, converts it to an absolute path with
 * the real filesystem, then hands it to the default resolver.
 */
module.exports = (request, options) => {
    if (request.startsWith("@/")) {
        const rel = request.slice(2); // strip "@/"
        return options.defaultResolver(
            path.join(options.rootDir, rel),
            options
        );
    }
    return options.defaultResolver(request, options);
};