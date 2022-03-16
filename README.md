# otnode-tester

Small Node.js app that sends API requests to an OriginTrail node, testing the different APIs. The application runs in a loop, provisioning an asset and then sending a number of requests to the different APIs.

## Usage

1. Clone repository to your node server: `git clone https://github.com/Aescwine/otnode-tester.git`
2. `cd otnode-tester`
 - Update `node-tester.js` as required, adjusting the number of requests per loop and the wait time between requests. Note: adjusting these will impact your node's performance.
2. Run command: `npm install`
3. Copy service file: `cp ./service/nodetester.service /lib/systemd/system/`
4. Enable service: `systemctl enable nodetester.service`
5. Start service (requires node to be running): `systemctl start nodetester.service`
6. Show service logs with `journalctl -u nodetester --output cat -fn 100`