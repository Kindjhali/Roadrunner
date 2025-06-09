/**
 * Fetches categorized models from the backend API.
 *
 * @param {number} backendPort - The port number of the backend server.
 * @returns {Promise<object>} - A promise that resolves to the categorized model data.
 * @throws {Error} - Throws an error if the fetch operation fails or the response is not ok.
 */
export async function fetchCategorizedModels(backendPort) {
  const response = await fetch(`http://127.0.0.1:${backendPort}/api/ollama-models/categorized`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to fetch categorized models and could not parse error response.' }));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}
