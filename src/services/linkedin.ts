const API_BASE = "/.netlify/functions";

export const fetchLinkedInProfile = async (token: string) => {
  const response = await fetch(`${API_BASE}/linkedin-profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "LinkedIn-Version": "202312",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch LinkedIn profile");
  }

  return response.json();
};

export const fetchLinkedInChangelog = async (
  token: string,
  count: number = 50
) => {
  console.log(`Fetching LinkedIn changelog with count: ${count}`);

  const response = await fetch(
    `${API_BASE}/linkedin-changelog?count=${count}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "LinkedIn-Version": "202312",
      },
    }
  );

  if (!response.ok) {
    console.error(`LinkedIn changelog API error: ${response.status} ${response.statusText}`);
    throw new Error("Failed to fetch LinkedIn changelog");
  }

  const data = await response.json();
  console.log('LinkedIn changelog response:', {
    hasElements: !!data.elements,
    elementsCount: data.elements?.length,
    resourceNames: data.elements?.map((e: any) => e.resourceName).slice(0, 10)
  });
  
  return data;
};

export const fetchLinkedInSnapshot = async (
  token: string,
  domain?: string,
  start?: number,
  count?: number
) => {
  const params = new URLSearchParams();
  if (domain) {
    params.append("domain", domain);
  }
  if (start !== undefined) {
    params.append("start", start.toString());
  }
  if (count !== undefined) {
    params.append("count", count.toString());
  }

  console.log(`Fetching LinkedIn snapshot for domain: ${domain}`);

  const response = await fetch(`${API_BASE}/linkedin-snapshot?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "LinkedIn-Version": "202312",
    },
  });

  if (!response.ok) {
    console.error(`LinkedIn snapshot API error: ${response.status} ${response.statusText}`);
    throw new Error("Failed to fetch LinkedIn snapshot");
  }

  const data = await response.json();
  console.log(`LinkedIn snapshot response for ${domain}:`, {
    hasElements: !!data.elements,
    elementsCount: data.elements?.length,
    firstElementKeys: data.elements?.[0] ? Object.keys(data.elements[0]) : [],
    snapshotDataCount: data.elements?.[0]?.snapshotData?.length
  });
  
  return data;
};

export const fetchLinkedInHistoricalPosts = async (
  token: string,
  daysBack: number = 90,
  start: number = 0,
  count: number = 10
) => {
  const params = new URLSearchParams({
    domain: "MEMBER_SHARE_INFO",
    start: start.toString(),
    count: count.toString(),
    daysBack: daysBack.toString(),
  });

  const response = await fetch(
    `${API_BASE}/linkedin-historical-posts?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "LinkedIn-Version": "202312",
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch LinkedIn historical posts");
  }

  return response.json();
};

export const createLinkedInPost = async (
  token: string,
  content: string,
  mediaFile?: File
) => {
  // Convert file to base64 if provided
  let mediaFileBase64: string | undefined;

  if (mediaFile) {
    try {
      mediaFileBase64 = await fileToBase64(mediaFile);
    } catch (error) {
      console.error("Error converting file to base64:", error);
      throw new Error("Failed to process media file");
    }
  }

  const response = await fetch(`${API_BASE}/linkedin-post`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "LinkedIn-Version": "202312",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content,
      mediaFile: mediaFileBase64,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
        `Failed to create LinkedIn post: ${response.statusText}`
    );
  }

  return response.json();
};

// Helper function to convert File to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

export const initiateLinkedInAuth = (type: "basic" | "dma" = "basic") => {
  const authUrl = `${API_BASE}/linkedin-oauth-start?type=${type}`;
  console.log("Redirecting to:", authUrl);
  window.location.href = authUrl;
};
