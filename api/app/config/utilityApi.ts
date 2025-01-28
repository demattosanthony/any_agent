interface FormResponse {
  uid: string;
  created: string;
  updated: string;
  template_uid: string;
  authorization_uid: string;
  url: string;
}

interface AuthorizationsParams {
  uids?: string[];
  forms?: string[];
  tempaltes?: string[];
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
}

interface AuthorizationNote {
  type: string;
  // Note: Additional properties might exist but aren't documenteds
}

interface ExportItem {
  name: string;
  link: string;
}

interface Scope {
  expires?: string;
  [key: string]: any;
}

interface CustomerSignature {
  type: string;
  ts: string;
}

interface Authorization {
  uid: string;
  created: string;
  customer_email: string;
  customer_signature: CustomerSignature | null;
  declined: string | null;
  is_declined: boolean;
  expires: string;
  is_expired: boolean;
  exports: Record<string, string>; // Deprecated
  exports_list: ExportItem[];
  form_uid: string | null;
  template_uid: string | null;
  referrals: string[];
  is_archived: boolean;
  is_test: boolean;
  notes: AuthorizationNote[];
  nickname: string | null;
  revoked: string | null;
  is_revoked: boolean;
  scope: Scope;
  status: "pending" | "updated" | "errored";
  status_message: string;
  status_ts: string;
  user_email: string;
  user_uid: string;
  user_status: "active" | "inactive";
  utility: string;
}

interface AuthorizationsResponse {
  authorizations: Authorization[];
  next: string | null;
}

interface MeterNote {
  type: string;
  [key: string]: any;
}

interface OngoingMonitoring {
  frequency: "off" | string;
  [key: string]: any;
}

interface MeterBlock {
  service_identifier: string;
  [key: string]: any;
}

interface MeterResponse {
  uid: string;
  authorization_uid: string;
  created: string;
  user_email: string;
  user_uid: string;
  is_archived: boolean;
  is_activated: boolean;
  notes: MeterNote[];
  status: "pending" | "updated" | "errored";
  status_message: string;
  status_ts: string;
  ongoing_monitoring: OngoingMonitoring;
  utility: string;
  bill_count: number;
  bill_coverage: [string, string][];
  bill_sources: string[];
  interval_count: number;
  interval_coverage: [string, string][];
  interval_sources: string[];
  exports: Record<string, string>; // Deprecated
  exports_list: ExportItem[];
  blocks: string[];
  is_expanded: boolean;
  [key: string]: MeterBlock | any; // For dynamic block_type fields
}

interface BillsParams {
  authorizations?: string[];
  meters?: string[];
  start?: string;
  end?: string;
  limit?: number;
  order?: "earliest_first" | "latest_first";
  after?: string;
}

interface Bill {
  uid: string;
  created: string;
  // Note: Adding other likely bill properties based on context
  authorization_uid: string;
  meter_uid: string;
  start: string;
  end: string;
}

interface BillListingResponse {
  bills: Bill[];
  next: string | null;
}

class UtilityApiClient {
  private baseUrl = "https://utilityapi.com/api/v2";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async createForm(
    customer_email: string,
    utility?: string
  ): Promise<FormResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/forms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          form: {
            customer_email,
            utility,
          },
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(
          `Failed to create form: ${res.status} ${res.statusText}${
            errorData ? ` - ${JSON.stringify(errorData)}` : ""
          }`
        );
      }

      const data = await res.json();

      if (!data || typeof data !== "object") {
        throw new Error("Invalid response format from API");
      }

      return data as FormResponse;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to create form: ${String(error)}`);
    }
  }

  async testSubmitForm(
    uid: string,
    utility: string,
    scenario: string
  ): Promise<{
    referral: string;
  }> {
    try {
      console.log(uid, utility, scenario);
      const res = await fetch(`${this.baseUrl}/forms/${uid}/test-submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          utility,
          scenario,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(
          `Failed to submit test form: ${res.status} ${res.statusText}${
            errorData ? ` - ${JSON.stringify(errorData)}` : ""
          }`
        );
      }

      const data = await res.json();

      if (!data || typeof data !== "object" || !("referral" in data)) {
        throw new Error("Invalid response format from API");
      }

      return data as { referral: string };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to submit test form: ${String(error)}`);
    }
  }

  async getAuthorizations(
    params: AuthorizationsParams
  ): Promise<AuthorizationsResponse> {
    // Convert params to a format suitable for URLSearchParams
    const searchParams: Record<string, string> = {};

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          searchParams[key] = value.join(",");
        } else if (typeof value === "boolean") {
          searchParams[key] = value.toString();
        } else {
          searchParams[key] = String(value);
        }
      }
    });

    console.log(searchParams);

    const res = await fetch(
      `${this.baseUrl}/authorizations?${new URLSearchParams(searchParams)}`,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        `Failed to fetch authorizations: ${res.status} ${res.statusText}`
      );
    }

    if (!data || typeof data !== "object") {
      throw new Error("Invalid response format from API");
    }

    return data as AuthorizationsResponse;
  }

  async metersHistoricalCollection(
    meters: string[],
    collection_duration?: number
  ): Promise<{
    success: boolean;
  }> {
    const res = await fetch(`${this.baseUrl}/meters/historical-collection`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        meters,
        collection_duration,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        `Failed to fetch historical collection: ${res.status} ${res.statusText}`
      );
    }

    if (!data || typeof data !== "object") {
      throw new Error("Invalid response format from API");
    }

    return data as { success: boolean };
  }

  async getMeter(
    meter_uid: string,
    expand_meter_blocks?: boolean
  ): Promise<MeterResponse> {
    const res = await fetch(
      `${this.baseUrl}/meters/${meter_uid}?expand_meter_blocks=${expand_meter_blocks}`,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(`Failed to fetch meter: ${res.status} ${res.statusText}`);
    }

    if (!data || typeof data !== "object") {
      throw new Error("Invalid response format from API");
    }

    return data as MeterResponse;
  }

  async getBills(params: BillsParams): Promise<BillListingResponse> {
    // Convert params to a format suitable for URLSearchParams
    const searchParams: Record<string, string> = {};

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          searchParams[key] = value.join(",");
        } else {
          searchParams[key] = String(value);
        }
      }
    });

    const res = await fetch(
      `${this.baseUrl}/bills?${new URLSearchParams(searchParams)}`,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(`Failed to fetch bills: ${res.status} ${res.statusText}`);
    }

    if (!data || typeof data !== "object") {
      throw new Error("Invalid response format from API");
    }

    return data as BillListingResponse;
  }
}

const utilityApiClient = new UtilityApiClient(process.env.UTILITY_API_KEY!);

export default utilityApiClient;
