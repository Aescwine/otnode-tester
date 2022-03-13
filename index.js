const NodeTester = require("./node-tester");
const Logger = require("./logger");

(async () => {
    try {
        const nodeTester = new NodeTester();
        await nodeTester.run();
    } catch (e) {
        console.log(`Error starting node tester: ${e}`);
    }
})();