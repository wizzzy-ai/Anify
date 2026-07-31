import dns from "node:dns";

// Force Node.js to use a reliable public DNS resolver
dns.setServers(["1.1.1.1", "1.0.0.1"]);

dns.resolveSrv("_mongodb._tcp.cluster0.hbr0yww.mongodb.net", (err, addresses) => {
  if (err) {
    console.error("DNS Error:", err);
  } else {
    console.log(addresses);
  }
});