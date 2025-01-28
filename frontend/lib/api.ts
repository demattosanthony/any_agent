import { Thread } from "@/types/chat";
import { Model } from "@/types/model";
import { User } from "@/types/user";

/**
 * ApiClient class handles all API communication with the backend server
 */
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async logout() {
    await fetch(`${this.baseUrl}/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch((error) => {
      console.error("Error:", error);
    });
  }

  async me(): Promise<User | null> {
    const response = await fetch(`${this.baseUrl}/auth/me`, {
      method: "GET",
      credentials: "include",
    });

    return await response.json();
  }

  async createCheckoutSession(lookupKey: string): Promise<string> {
    const response = await fetch(
      `${this.baseUrl}/payments/create-checkout-session`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          lookup_key: lookupKey,
        }),
      }
    );

    const data = await response.json();

    return data.url;
  }

  async syncAfterSuccess(sessionId: string) {
    const response = await fetch(
      `${this.baseUrl}/payments/sync-after-success`,
      {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ session_id: sessionId }),
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return response;
  }

  async createPortalSession() {
    const response = await fetch(
      `${this.baseUrl}/payments/create-portal-session`,
      {
        method: "POST",
        credentials: "include",
      }
    );

    const data = await response.json();

    return data.url;
  }

  /**
   * Fetches the list of available AI models from the server
   * @returns Promise containing array of Model objects
   */
  async getAvailableModels(): Promise<Model[]> {
    const url = `${this.baseUrl}/models`;

    const response = await fetch(url, {
      method: "GET",
    });

    return await response.json();
  }

  async getPresignedUrl(
    filename: string,
    mime_type: string,
    size: number
  ): Promise<{
    url: string;
    viewUrl: string;
    file_metadata: {
      filename: string;
      mime_type: string;
      file_key: string;
      size: number;
    };
  }> {
    const url = `${this.baseUrl}/presigned-url`;

    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify({ filename, mime_type, size }),
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    return await response.json();
  }

  /**
   * Creates a new conversation thread
   * @returns Promise containing the thread ID
   */
  async createThread(): Promise<{ id: string }> {
    const url = `${this.baseUrl}/threads`;

    const response = await fetch(url, {
      method: "POST",
      credentials: "include",
    });

    if (response.status === 402) {
      throw new Error("subscription_required");
    }

    if (!response.ok) {
      throw new Error("failed_to_create_thread");
    }

    return await response.json();
  }

  /**
   * Retrieves all conversation threads with their messages
   * @returns Promise containing array of thread objects with messages
   */
  async getThreads(page: number = 1, search: string = ""): Promise<Thread[]> {
    const url = `${
      this.baseUrl
    }/threads?page=${page}&search=${encodeURIComponent(search)}`;

    try {
      const response = await fetch(url, {
        credentials: "include",
      });

      if (response.status === 401) {
        // Return empty array silently for unauthorized users
        return [];
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.message ||
            `Failed to fetch threads: ${response.status} ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      // Only log errors that aren't 401
      if (error instanceof Error && !error.message.includes("401")) {
        console.error("Error fetching threads:", error);
      }

      // Return empty array for any error
      return [];
    }
  }

  /**
   * Retrieves a specific thread and its messages
   * @param threadId - ID of the thread to retrieve
   * @returns Promise containing thread object with messages
   */
  async getThread(threadId: string): Promise<Thread> {
    const url = `${this.baseUrl}/threads/${threadId}`;

    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
    });

    return await response.json();
  }

  /**
   * Adds a new message to an existing thread
   * @param threadId - ID of the thread to add message to
   * @param role - Role of the message sender (user/assistant)
   * @param content - Array of message content objects (can include text, images, or files)
   * @returns Promise containing array of created messages
   */
  async addMessageToThread(
    threadId: string,
    role: string,
    content: {
      type: "image" | "text" | "file";
      text?: string;
      file_metadata?: {
        filename: string;
        mime_type: string;
        file_key: string;
        size: number;
      };
    }[]
  ): Promise<
    {
      id: string;
      thread_id: string;
      role: string;
      content: { type: "image" | "text"; image?: string; text?: string }[];
      created_at: number;
    }[]
  > {
    const url = `${this.baseUrl}/threads/${threadId}/messages`;

    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify({ role, content }),
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    return await response.json();
  }

  /**
   * Runs model inference on a thread, streaming back results
   * @param threadId - ID of the thread to run inference on
   * @param modelName - Name of the AI model to use
   * @param instructions - System instructions for the AI model
   * @param temperature - Temperature parameter for model inference
   * @param signal - AbortSignal for cancelling the stream
   * @returns AsyncGenerator yielding JSON strings containing events and data
   */
  async *runInference(
    threadId: string,
    modelName: string,
    instructions: string,
    temperature: number,
    signal: AbortSignal
  ): AsyncGenerator<string> {
    const url = `${this.baseUrl}/threads/${threadId}/inference`;
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify({ model: modelName, temperature, instructions }),
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    if (!response.body) throw new Error("Response body is empty");

    // Set up stream reading
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        // Check for abort signal
        if (signal.aborted) {
          console.log("Signal aborted, stopping stream");
          break;
        }

        // Read chunk from stream
        let result;
        try {
          result = await reader.read();
        } catch (error) {
          if ((error as DOMException).name === "AbortError") {
            console.log("Read aborted");
            throw error;
          } else {
            throw error;
          }
        }

        const { value, done } = result;
        if (done) break;

        // Process incoming data
        buffer += decoder.decode(value, { stream: true });
        let eventEnd = buffer.indexOf("\n\n");

        // Parse SSE format and yield events
        while (eventEnd > -1) {
          const event = buffer.slice(0, eventEnd);
          buffer = buffer.slice(eventEnd + 2);

          const eventMatch = event.match(/event: (.*)/);
          const dataMatch = event.match(/data: (.*)/);

          if (eventMatch && dataMatch) {
            try {
              const jsonData = JSON.parse(dataMatch[1]);
              yield JSON.stringify({ event: eventMatch[1], data: jsonData });
            } catch (error) {
              console.error("Error parsing JSON:", error);
            }
          }

          eventEnd = buffer.indexOf("\n\n");
        }
      }
    } catch (error) {
      if ((error as DOMException).name === "AbortError") {
        console.log("Stream aborted");
        throw error;
      } else {
        throw error;
      }
    } finally {
      // Clean up resources
      if (signal.aborted) {
        await reader.cancel();
      } else {
        reader.releaseLock();
      }
    }
  }

  /// UTILITY API INTEGRATION
  async createUtilityApiForm(email: string): Promise<{
    uid: string;
    url: string;
    authorization_url: string;
  }> {
    const response = await fetch(`${this.baseUrl}/utilities/create-form`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ email }),
    });

    return await response.json();
  }

  async testSubmitForm(
    uid: string,
    utility: string,
    scenario: string
  ): Promise<{
    referral: string;
  }> {
    const response = await fetch(
      `${this.baseUrl}/utilities/forms/${uid}/test-submit-form`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ utility, scenario }),
      }
    );

    return await response.json();
  }

  async triggerHistoricalCollection(meters: string[]) {
    const response = await fetch(`${this.baseUrl}/utilities/meters`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ meters }),
    });

    return await response.json();
  }

  async getMeters(meterId: string) {
    const response = await fetch(
      `${this.baseUrl}/utilities/meters/${meterId}`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    return await response.json();
  }

  async getAuthorizations(params: {
    uids?: string[];
    forms?: string[];
    templates?: string[];
    users?: string[];
    referrals?: string[];
    is_archived?: boolean;
    is_declined?: boolean;
    is_test?: boolean;
    is_revoked?: boolean;
    is_expired?: boolean;
    utility?: string[];
    after?: string;
    include?: string[];
    expand_meter_blocks?: boolean;
    limit?: number;
  }) {
    // Convert params to URLSearchParams
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          searchParams.append(key, value.join(","));
        } else if (typeof value === "boolean") {
          searchParams.append(key, value.toString());
        } else if (typeof value === "number") {
          searchParams.append(key, value.toString());
        } else {
          searchParams.append(key, value);
        }
      }
    });

    const response = await fetch(
      `${this.baseUrl}/utilities/authorizations?${searchParams.toString()}`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    return await response.json();
  }
}

// Create and export a instance of ApiClient
const api = new ApiClient(process.env.NEXT_PUBLIC_API_URL!);

export default api;
