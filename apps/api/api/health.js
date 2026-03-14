export default function handler(_request, response) {
  response.statusCode = 200;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify({
    status: "ok",
    service: "@wms/api",
    timestamp: new Date().toISOString()
  }));
}
