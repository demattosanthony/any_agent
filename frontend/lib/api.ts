import { Thread } from "@/types/chat";
import { Model } from "@/types/model";
import { User } from "@/types/user";

/**
 * ApiClient class handles all API communication with the backend server
 */
class ApiClient {
  public baseUrl: string;

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

  async createOrganization(name: string, domain: string) {
    const res = await fetch(`${this.baseUrl}/organizations`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, domain }),
    });

    if (!res.ok) {
      throw new Error("Failed to create organization");
    }

    return await res.json();
  }

  async organizationConfigureSaml(
    org: { id: string; slug: string },
    entryPoint: string,
    issuer: string,
    cert: string
  ) {
    const res = await fetch(`${this.baseUrl}/organizations/${org.id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saml: {
          entryPoint,
          issuer,
          cert,
          callbackUrl: `${this.baseUrl}/auth/saml/${org.slug}/callback`,
        },
      }),
    });

    return res;
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
}

// Create and export a instance of ApiClient
const api = new ApiClient(process.env.NEXT_PUBLIC_API_URL!);

export default api;
