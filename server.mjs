import http from 'node:http';

// Start a simple HTTP server and log every request and its body
const server = http.createServer((req, res) => {
  console.log(`Request received for ${req.url}`);
  console.log(`Method: ${req.method}`);

  let body = '';
  req.on('data', (chunk) => {
    body += chunk.toString(); // Convert Buffer to string
  });

  req.on('end', () => {
    console.log(`Body: ${body}`); // Log the body of the request
    res.end('Hello World');
  });
});

server.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
