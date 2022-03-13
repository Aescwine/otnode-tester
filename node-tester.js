const axios = require("axios");
const randomstring = require("randomstring");
const Logger = require("./logger");
const FormData = require("form-data");
const fs = require("fs");

class NodeTester {

    constructor(options) {
        this.logger = new Logger("debug");
        this.nodeBaseUrl = 'http://0.0.0.0:8900';
        this.defaultTimeoutInSeconds = 30;
    }

    async run() {

        await this.sendNodeInfoRequest().then((result) => console.log(result.data))
            .catch((error) => {
                throw new Error(`Endpoint not available: ${error}`);
            });

        while (true) {
            let keyword = 'keyword' + randomstring.generate(5);

            let publishOptions = {
                filepath: "assertion-example.json",
                method: "provision",
                keywords: [keyword],
                visibility: "public",
            }

            try {
                let publishHandlerId = await this.publishRequest(publishOptions).then(result => {
                    this.logger.debug(`Publish complete. Handler id: ${result.data.handler_id}`);
                    return result.data.handler_id;
                }).catch((error) => {
                    console.log(error);
                })

                await this.sleepForMilliseconds(15 * 1000); // sleep for 15 seconds

                let publishedUal = await this.getProvisionResult(publishHandlerId).then(provisionResult => {
                    this.logger.debug(`Provision result received: ${provisionResult.data}`);

                    let ual = provisionResult.data.data.metadata.UALs[0];
                    return ual;
                });

                // this.logger.debug(`Resolve UAL ${publishedUal}`);
                // for (let i = 0; i < 1000; i++) {
                //     this.resolveRequest(publishedUal);
                //     await this.sleepForMilliseconds(500); // sleep for half a second
                // }

                this.logger.debug(`Entity search for keyword ${keyword}`);
                for (let i = 0; i < 100; i++) {
                    this.searchRequest({query: keyword, resultType: "entities"});
                    await this.sleepForMilliseconds(1000); // sleep for 1 second
                }

                this.logger.debug(`Assertion search for keyword ${keyword}`);
                for (let i = 0; i < 100; i++) {
                    this.searchRequest({query: keyword, resultType: "assertions"});
                    await this.sleepForMilliseconds(1000); // sleep for 1 second
                }

                this.logger.debug(`Sparql query for keyword ${keyword}`);
                for (let i = 0; i < 1000; i++) {
                    this.resolveRequest(publishedUal);
                    await this.sleepForMilliseconds(500); // sleep for half a second
                }


            } catch (e) {
                this.logger.error(e);
            }
        }
    }

    async sleepForMilliseconds(milliseconds) {
        await new Promise((r) => setTimeout(r, milliseconds));
    }

    async sendNodeInfoRequest() {
        this.logger.debug("Sending node info request");
        return axios.get(`${this.nodeBaseUrl}/info`, {
            timeout: this.defaultTimeoutInSeconds * 1000,
        });
    }

    async publishRequest(options) {
        this.logger.debug(`Sending publish request. ${new Date().toGMTString()}`);
        const form = new FormData();
        if (options.filepath) {
            form.append("file", fs.createReadStream(options.filepath));
        } else {
            form.append("data", options.data);
        }
        form.append("keywords", JSON.stringify(options.keywords));
        if (options.ual) {
            form.append("ual", options.ual);
        }
        form.append("visibility", options.visibility);
        let axios_config = {
            method: "post",
            url: `${this.nodeBaseUrl}/${options.method}`,
            headers: {
                ...form.getHeaders(),
            },
            data: form,
        };

        return axios(axios_config);
    }

    async getProvisionResult(handlerId) {
        if (!handlerId) {
            throw Error("Unable to get results, need handler id");
        }
        const form = new FormData();
        let axios_config = {
            method: "get",
            url: `${this.nodeBaseUrl}/provision/result/${handlerId}`,
            headers: {
                ...form.getHeaders(),
            },
        };

        return axios(axios_config);
    }

    resolveRequest(ual) {
        this.logger.debug(`Sending resolve request. ${new Date().toGMTString()}`);
        const form = new FormData();
        let ids = `ids=${ual}`;

        let axios_config = {
            method: "get",
            url: `${this.nodeBaseUrl}/resolve?${ids}`,
            headers: {
                ...form.getHeaders(),
            },
            data: form,
        };
        return axios(axios_config);
    }

    searchRequest(options) {
        this.logger.debug(`Sending search request. ${new Date().toGMTString()}`);
        const form = new FormData();
        let query = options.query;
        let resultType = options.resultType;
        let url = `${this.nodeBaseUrl}/${resultType}:search?query=${query}`;
        let axios_config = {
            method: "get",
            url,
            headers: {
                ...form.getHeaders(),
            },
            data: form,
        };
        return axios(axios_config);
    }

    queryRequest(options) {
        this.logger.debug(`Sending query request. ${new Date().toGMTString()}`);
        const form = new FormData();
        let type = options.type ? options.type : "construct";
        let sparqlQuery = options.query;
        try {
            this.sparqlParser.parse(sparqlQuery);
        } catch (error) {
            throw new Error(`Sparql query error: ${error}`);
        }
        form.append("query", sparqlQuery);
        let axios_config = {
            method: "post",
            url: `${this.nodeBaseUrl}/query?type=${type}`,
            headers: {
                ...form.getHeaders(),
            },
            data: form,
        };
        return axios(axios_config);
    }

    getProofsRequest(options) {
        this.logger.debug(`Sending get proofs request. ${new Date().toGMTString()}`);
        const form = new FormData();
        let nquads = options.nquads;
        form.append("nquads", JSON.stringify(nquads));
        let axios_config = {
            method: "post",
            url: `${this.nodeBaseUrl}/proofs:get`,
            headers: {
                ...form.getHeaders(),
            },
            data: form,
        };
        return axios(axios_config);
    }
}

module.exports = NodeTester;