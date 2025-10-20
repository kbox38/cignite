export async function handler(event, context) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
    };
  }

  const { authorization } = event.headers;
  const { startTime, count = "50" } = event.queryStringParameters || {};

  console.log(
    "LinkedIn Changelog Function - Count:",
    count,
    "StartTime:",
    startTime
  );
  console.log(
    "LinkedIn Changelog Function - Authorization header present:",
    !!authorization
  );

  if (!authorization) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "No authorization token" }),
    };
  }

  try {
    let url = `https://api.linkedin.com/rest/memberChangeLogs?q=memberAndApplication&count=${count}`;
    if (startTime) {
      url += `&startTime=${startTime}`;
    }

    console.log("LinkedIn Changelog Function - Calling URL:", url);

    const response = await fetch(url, {
      headers: {
        Authorization: authorization,
        "LinkedIn-Version": "202312",
        "Content-Type": "application/json",
      },
    });

    console.log(
      "LinkedIn Changelog Function - Response status:",
      response.status
    );
    console.log(
      "LinkedIn Changelog Function - Response headers:",
      Object.fromEntries(response.headers.entries())
    );

    const data = await response.json();
    console.log("LinkedIn Changelog Function - Response data structure:", {
      hasElements: !!data.elements,
      elementsLength: data.elements?.length || 0,
      firstElementKeys: data.elements?.[0] ? Object.keys(data.elements[0]) : [],
      resourceNames: data.elements?.map((el) => el.resourceName) || [],
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error("LinkedIn Changelog Function - Error:", error);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to fetch LinkedIn changelog data",
        details: error.message,
      }),
    };
  }
}
