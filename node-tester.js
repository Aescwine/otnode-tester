const axios = require("axios");
const randomstring = require("randomstring");
const Logger = require("./logger");
const FormData = require("form-data");
const fs = require("fs");
const SparqlParser = require("sparqljs").Parser;
class NodeTester {

    constructor(options) {
        this.logger = new Logger("debug");
        this.nodeBaseUrl = 'http://0.0.0.0:8900';
        this.defaultTimeoutInSeconds = 30;
        this.sparqlParser = new SparqlParser({ skipValidation: false });
    }

    async run() {

        let running = false;
        let i = 0;

        while (!running) {
            await this.sendNodeInfoRequest().then((result) => {
                console.log(result.data);
                running = true;
            }).catch((error) => {
                this.logger.error(`Endpoint not available: ${error}. Waiting 3 minutes before trying again.`);
                this.sleepForMilliseconds(3 * 60 * 1000); // sleep for 3 minutes
            });
        }

        while (true) {
            let keyword = 'keyword' + randomstring.generate(5);

            let publishOptions = {
                filepath: "assertion-example.json",
                method: "provision",
                keywords: [keyword],
                visibility: "public",
            }

            try {
                this.logger.debug(`Sending publish request number ${i}. ${new Date().toGMTString()}`);
                let publishHandlerId = await this.publishRequest(publishOptions).then(result => {
                    this.logger.debug(`Publish complete. Handler id: ${result.data.handler_id}`);
                    return result.data.handler_id;
                }).catch((error) => {
                    console.log(error);
                })

                await this.sleepForMilliseconds(30 * 1000); // sleep for 30 seconds

                let publishedData = await this.getProvisionResult(publishHandlerId).then(provisionResult => {
                    this.logger.debug(`Provision result received: ${provisionResult.data}`);

                    return provisionResult.data;
                });

                let provisionStatus = publishedData.status;
                this.logger.debug(`Provision result status: ${provisionStatus}`);

                let assertionId = publishedData.data.id;
                let ual = publishedData.data.metadata.UALs[0];

                this.logger.debug(`Resolve UAL ${ual}`);

                this.logger.debug(`Sending resolve request number ${i}. ${new Date().toGMTString()}`);
                this.resolveRequest(ual);
                await this.sleepForMilliseconds(5 * 1000); // sleep for 5 seconds

                this.logger.debug(`Entity search for keyword ${keyword}`);

                this.logger.debug(`Sending entity search request number ${i}. ${new Date().toGMTString()}`);
                this.searchRequest({ query: keyword, resultType: "entities" });
                await this.sleepForMilliseconds(5 * 1000); // sleep for 5 seconds

                this.logger.debug(`Assertion search for keyword ${keyword}`);

                this.logger.debug(`Sending assertion search request number ${i}. ${new Date().toGMTString()}`);
                this.searchRequest({ query: keyword, resultType: "assertions" });
                await this.sleepForMilliseconds(5 * 1000); // sleep for 5 seconds

                this.logger.debug(`Sparql query for keyword ${keyword}`);

                let sparqlQuery = 'PREFIX schema: <http://schema.org/> ' +
                    'CONSTRUCT { ?s schema:hasKeywords "' + keyword + '". } ' +
                    'WHERE { ' +
                    'GRAPH ?g { ' +
                    '?s schema:hasKeywords "' + keyword + '" . ' +
                    '}' +
                    '}';

                this.logger.debug(`Sparql query: ${sparqlQuery}`);

                this.logger.debug(`Sending query request number ${i}. ${new Date().toGMTString()}`);
                this.queryRequest({ query: sparqlQuery });
                await this.sleepForMilliseconds(5 * 1000); // sleep for 5 seconds

                let proofQuery = `["<did:dkg:${assertionId}> <http://schema.org/hasKeywords> \\"${keyword}\\" ."]`;

                this.logger.debug(`Proofs query: ${proofQuery}`);
                this.logger.debug(`Sending get proofs request number ${i}. ${new Date().toGMTString()}`);
                this.proofsRequest({ nquads: proofQuery });
                
                i++;
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
        let retries = 0;
        let status = 'PENDING';
        let response = null;
        while (status === 'PENDING') {
            if (retries > 3) {
                throw Error("Unable to get results. Max number of retries reached.");
            }
            retries++;
            await this.sleepForMilliseconds(10 * 1000);
            try {
                response = await axios(axios_config);
                status = response.data.status;
            } catch (e) {
                this.logger.error(e);
                throw e;
            }
        }

        return response;
    }

    resolveRequest(ual) {
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

    proofsRequest(options, requestNumber = 1) {
        const form = new FormData();
        let nquads = options.nquads;
        form.append("nquads", nquads);
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