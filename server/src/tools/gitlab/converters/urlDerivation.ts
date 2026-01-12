/**
 * URL Derivation Logic
 *
 * Derives documentation URLs from GitLab file paths.
 * Works for Antora-style documentation structures.
 *
 * GitLab path: canton/modules/ROOT/pages/validator-mgmt/create-validator.adoc
 * Live URL:    https://docs.example.com/canton/validator-mgmt/create-validator.html
 */

export interface UrlDerivationConfig {
  docsBaseUrl: string;  // e.g., "https://docs.catalyst.intellecteu.com"
  productMappings?: Record<string, string> | undefined;  // e.g., {"catbm": "general"}
}

export interface DerivedUrlInfo {
  product: string;      // e.g., "canton"
  subpath: string;      // e.g., "validator-mgmt"
  filename: string;     // e.g., "create-validator"
  fullUrl: string;      // e.g., "https://docs.example.com/canton/validator-mgmt/create-validator.html"
}

/**
 * Default product mappings for URL derivation
 * Maps GitLab folder names to URL path segments
 */
const DEFAULT_PRODUCT_MAPPINGS: Record<string, string> = {
  'catbm': 'general',
  'catalyst-package-manager': 'cpm',
};

/**
 * Derive documentation URL from GitLab file path
 *
 * @param gitlabPath - Full path in GitLab (e.g., "canton/modules/ROOT/pages/validator-mgmt/create-validator.adoc")
 * @param config - URL derivation configuration
 * @returns Derived URL information
 */
export function deriveDocumentationUrl(
  gitlabPath: string,
  config: UrlDerivationConfig
): DerivedUrlInfo {
  const { docsBaseUrl, productMappings = {} } = config;
  const mergedMappings = { ...DEFAULT_PRODUCT_MAPPINGS, ...productMappings };

  // Normalize path separators
  const normalizedPath = gitlabPath.replace(/\\/g, '/');

  // Extract components from path
  // Pattern: {product}/modules/ROOT/pages/{subpath}/{filename}.adoc
  // Or:      {product}/modules/ROOT/pages/{filename}.adoc

  const parts = normalizedPath.split('/');

  // Find the product (first path segment before 'modules')
  let product = '';
  const modulesIndex = parts.indexOf('modules');
  if (modulesIndex > 0) {
    product = parts[modulesIndex - 1] || '';
  } else {
    // Fallback: use first path segment
    product = parts[0] || '';
  }

  // Apply product mappings
  const mappedProduct = mergedMappings[product] || product;

  // Find path after 'pages/'
  const pagesIndex = parts.indexOf('pages');
  let subpath = '';
  let filename = '';

  if (pagesIndex >= 0 && pagesIndex < parts.length - 1) {
    // Everything after 'pages/' up to the last segment is the subpath
    const afterPages = parts.slice(pagesIndex + 1);

    if (afterPages.length > 1) {
      // Has subfolders
      subpath = afterPages.slice(0, -1).join('/');
      filename = afterPages[afterPages.length - 1] || '';
    } else {
      // Just a filename
      filename = afterPages[0] || '';
    }
  } else {
    // Fallback: use last segment as filename
    filename = parts[parts.length - 1] || '';
  }

  // Remove extension from filename
  filename = filename.replace(/\.(adoc|asciidoc|md|markdown|txt)$/i, '');

  // Build full URL
  const baseUrl = docsBaseUrl.replace(/\/$/, ''); // Remove trailing slash
  let fullUrl: string;

  if (subpath) {
    fullUrl = `${baseUrl}/${mappedProduct}/${subpath}/${filename}.html`;
  } else {
    fullUrl = `${baseUrl}/${mappedProduct}/${filename}.html`;
  }

  return {
    product: mappedProduct,
    subpath,
    filename,
    fullUrl,
  };
}

/**
 * Extract product name from GitLab path
 * Used for adding product context to converted documents
 */
export function extractProductName(gitlabPath: string): string {
  const normalizedPath = gitlabPath.replace(/\\/g, '/');
  const parts = normalizedPath.split('/');

  // Find product (segment before 'modules')
  const modulesIndex = parts.indexOf('modules');
  if (modulesIndex > 0) {
    return parts[modulesIndex - 1] || 'Unknown';
  }

  // Check for known patterns
  const lowerPath = normalizedPath.toLowerCase();
  if (lowerPath.includes('canton')) return 'Canton';
  if (lowerPath.includes('cpm') || lowerPath.includes('catalyst-package-manager')) {
    return 'Catalyst Package Manager (CPM)';
  }
  if (lowerPath.includes('catbm')) return 'Catalyst Blockchain Manager';

  // Fallback: first segment
  return parts[0] || 'Unknown';
}

/**
 * Get a human-readable product context string
 */
export function getProductContext(productName: string, baseContext?: string): string {
  const product = productName.toLowerCase();

  const contexts: Record<string, string> = {
    'canton': 'Canton documentation for Catalyst Blockchain Manager',
    'cpm': 'Catalyst Package Manager (CPM)',
    'catalyst-package-manager': 'Catalyst Package Manager (CPM)',
    'catbm': 'Catalyst Blockchain Manager',
    'general': 'Catalyst Blockchain Manager',
  };

  if (baseContext) {
    return `${baseContext} - ${contexts[product] || productName}`;
  }

  return contexts[product] || productName;
}

/**
 * Convert output filename from .adoc to .md
 */
export function getOutputFilename(gitlabPath: string): string {
  const normalizedPath = gitlabPath.replace(/\\/g, '/');
  const parts = normalizedPath.split('/');
  let filename = parts[parts.length - 1] || 'unknown.md';

  // Replace extension
  filename = filename.replace(/\.(adoc|asciidoc)$/i, '.md');

  return filename;
}

/**
 * Determine the output folder based on the source path
 * Used for organizing converted files
 */
export function getOutputFolder(gitlabPath: string): string {
  const normalizedPath = gitlabPath.replace(/\\/g, '/').toLowerCase();

  if (normalizedPath.includes('/catbm/')) {
    return 'GeneralCATBM';
  }
  if (normalizedPath.includes('/cpm/') || normalizedPath.includes('catalyst-package-manager')) {
    return 'CPM';
  }
  if (normalizedPath.includes('/canton/')) {
    return 'Canton';
  }

  // Default to the product name
  const parts = normalizedPath.split('/');
  const modulesIndex = parts.indexOf('modules');
  if (modulesIndex > 0) {
    return parts[modulesIndex - 1] || 'General';
  }

  return 'General';
}
