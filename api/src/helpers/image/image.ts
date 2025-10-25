import GoogleImages from "google-images";

// Initialize Google Images client
const googleClient = new GoogleImages(
  process.env.GOOGLE_CSE_ID!,
  process.env.GOOGLE_API_KEY!
);

/**
 * Takes a keyword and optional description, returns the top image URL from Google Images
 * @param keyword - Main search term to find image for
 * @param description - Optional 1-2 sentence description for more context (makes search more accurate)
 * @returns URL string of the top image result
 */
export async function getImageForKeyword(keyword: string, description: string): Promise<string> {
  // Combine keyword with description for more accurate search
  const searchQuery = description ? `${keyword} ${description}` : keyword;

  const results = await googleClient.search(searchQuery, { size: 'large' });

  if (!results || results.length === 0) {
    throw new Error(`No images found for: ${keyword}`);
  }

  return results[0].url;
}