const mongoose = require("mongoose");
const _ = require("lodash");
require('moment-timezone');
const {
    simsBoardSchema
} = require("./simBoardSchema");
const {
    createPostForSaleJobBySimIds,
    jobSchema,
} = require("./postForSaleJobs");
const elasticsearch = require("./elasticsearch");
const {
    delMemcache
} = require("./memcache");
const crypto = require("crypto");
const upsertMany = require("@meanie/mongoose-upsert-many");

mongoose.plugin(upsertMany);
const getCollectionName = (agency_id) => `kho${agency_id}`;

const removeSale = async (
    data,
    updated_at,
    is_admin = false,
    user = null,
    request_id = null,
    size = 0,
    from = 0
) => {

    let query = [];
    let arrQuerySim = [];
    let arrLogSim = [];
    let arrJobLogsim = []
    if (!is_admin) {
        
        data.map((sim) => arrQuerySim.push(sim.sim));
        let sim = await getElasticSims(arrQuerySim);
        const dataMap = _.groupBy(
            [
                ...data.map((agency) => ({
                    agency
                })),
                ...sim.map((element) => ({
                    element
                })),
            ],
            (m) => (m.agency && m.agency.sim) || (m.element && m.element.id)
        );

        _.values(dataMap).map(async (arr) => {
            const agency = arr.find((m) => m.agency).agency;
            const element = (arr.find((m) => m.element) || {}).element;
            if (!element) return;
            if (element.s3.length === 0) return;
            element.s3 = _.remove(element.s3, function (n) {
                return parseInt(agency.agency_id) !== n
            })
            let s_filter = element.s.filter((sim) =>
                sim.rs ?
                sim.rs === true && sim.id == agency.agency_id :
                sim.id == agency.agency_id
            );
            let getOldAgencySaleSim = element.s.filter(
                (agency_s) =>
                agency_s.rs != false &&
                agency_s.d == false &&
                agency_s.id != agency.agency_id &&
                agency_s !== null
            );
            let maxTimeOfLastAgencySaleSim = Math.max(
                ...getOldAgencySaleSim.map((b) => b.l.sec)
            );
            let getMinPb = {};
            delete element.cr;

            if (getOldAgencySaleSim.length > 0) {
                let getMaxValue = getOldAgencySaleSim.reduce(
                    (prev, curr) => {
                        return prev.pb > curr.pb ? prev : curr;
                    }
                );
                element.p = getMaxValue.pb;
                element.pb = getMaxValue.pb;
                element.pg = getMaxValue.pg;
                element.l.sec = maxTimeOfLastAgencySaleSim;

                getMinPb = getOldAgencySaleSim.reduce((prev, curr) => {
                    return prev.pg < curr.pg ? prev : curr;
                });
            } else {
                element.p = 0;
                element.pb = 0;
                element.pg = 0;
                getMinPb = {
                    rs: false
                };
            }
            query.push({
                update: {
                    _index: "khoso",
                    _type: "sim",
                    _id: element.id, //"số si",
                },
            });
            s_filter.map((sim_element) => {
                let data_log = {
                    ...sim_element,
                    sim: element.id,
                    l_type: 2,
                };
                arrLogSim.push(data_log);
            });
            element.s = getOldAgencySaleSim;
            element.s4 = getMinPb;

            query.push({
                doc: element,
            });
        })

        try {
            if (query.length > 0) {
                await elasticsearch.bulk({
                    body: query,
                })
            }
            sim.map(x => {
                x.s.map(y => {
                    arrJobLogsim.push({
                        sim: x.id,
                        root_agency: y.id
                    })
                })

            })
            return
        } catch (error) {
            console.log(error);
        }
    } else {
        let offset_new = from ? from : 0; //offset
        let limit = size ? size : 10000; //limit
        const simsJobModel = mongoose.model("post_for_sale_jobs", jobSchema);
        let query_data = buildQRSearchSimByCode(
            user.agency_id,
            limit,
            offset_new
        );

        let result_data = await elasticsearch.search(query_data);
        let data_search = result_data.body.hits.hits.map((m) => m._source);

        let sim_to_remove = data_search.map((sim) => sim.id);

        let countPendingJobs = await simsJobModel.findOne({
            request_id: request_id,
        });

        if (sim_to_remove.length < 10000 && !countPendingJobs) {
            let data_to_remove_with_agencyid = sim_to_remove.map((sim) => ({
                sim: sim,
                agency_id: user.agency_id,
            }));
            await removeSale(data_to_remove_with_agencyid, new Date());
            const collection_name = getCollectionName(user.agency_id);
            const model = mongoose.model(collection_name, simsBoardSchema);
            await model.deleteMany({
                sell_status: 1,
                sim: {
                    $in: sim_to_remove
                },
            });
        } else {
            await createPostForSaleJobBySimIds(
                user,
                sim_to_remove,
                2,
                request_id,
                new Date(),
                false,
                true
            );
            let query_count = buildQRSearchSimByCode(
                user.agency_id,
                10000,
                offset_new + 10000
            );
            let result_count = await elasticsearch.search(query_count);
            if (result_count.body.hits.hits.length > 0) {
                await removeSale({},
                    new Date(),
                    true,
                    user,
                    request_id,
                    10000,
                    offset_new + 10000
                );
            } else {
                await simsJobModel.updateMany({
                    request_id: request_id,
                    status: "WAITING_JOB"
                }, {
                    status: "PENDING",
                    updated_at: new Date()
                });
                return;
            }
        }
    }
};

const changeSaledSimES = async (data) => {
    let query = [];

    let arrQuerySim = [];
    data.map((sim) => arrQuerySim.push(sim.sim));
    let sim = await getElasticSims(arrQuerySim);

    const dataMap = _.groupBy(
        [
            ...data.map((agency) => ({ agency })),
            ...sim.map((element) => ({ element })),
        ],
        (m) => (m.agency && m.agency.sim) || (m.element && m.element.id)
    );

    _.values(dataMap).map((arr) => {
        const agency = arr.find((m) => m.agency).agency;
        const element = (arr.find((m) => m.element) || {}).element;
        if (!element) return;

        let newS3 = (element.s3 || []).filter(
            (e) => e !== parseInt(agency.agency_id)
        );

        element.s3 = newS3;
        let sim = element.s.filter((sim) =>
            sim.rs
                ? sim.rs === true && sim.id == agency.agency_id
                : sim.id == agency.agency_id
        );
        let getOldAgencySaleSim = element.s.filter(
            (agency_s) =>
                agency_s.rs != false &&
                agency_s.d == false &&
                agency_s.id != agency.agency_id
        );
        let maxTimeOfLastAgencySaleSim = Math.max(
            ...getOldAgencySaleSim.map((b) => b.l.sec)
        );
        if (getOldAgencySaleSim.length > 0) {
            let getMaxValue = getOldAgencySaleSim.reduce((prev, curr) => {
                return prev.pb > curr.pb ? prev : curr;
            });
            element.p = getMaxValue.pb;
            element.pb = getMaxValue.pb;
            element.pg = getMaxValue.pg;
            element.l.sec = maxTimeOfLastAgencySaleSim;
        } else {
            element.p = 0;
            element.pb = 0;
            element.pg = 0;
            // element.l.sec = 0
        }

        sim.map((sim_element) => {
            query.push({
                update: {
                    _index: "khoso",
                    _type: "sim",
                    _id: element.id, //"số sim",
                },
            });
            sim_element.d = true;
            let data_log = { ...sim_element, sim: element.id };
            // sendLogToLogstash([data_log]);
            // sim_element.rs = false;
            element.s = element.s.filter((item) => item.id != sim_element.id);
            query.push({
                doc: element,
            });
        });
    });

    const a =
        query.length &&
        (await elasticsearch.bulk({
            body: query,
        }));
};

const buildQRSearchSimByCode = (agencyId, limit, offset) => {
    let arr_must = new Array();
    return {
        body: {
            track_total_hits: true,
            query: {
                bool: {
                    must: [{ term: { s3: agencyId } }],
                    must_not: [],
                    should: [],
                },
            },
            from: offset,
            size: limit,
            sort: [
                {
                    "l.sec": {
                        order: "asc",
                    },
                },
            ],
        },
    };
};
const getElasticSims = async (phones) => {
    const query = {
        body: {
            query: {
                bool: {
                    must: [{
                        terms: {
                            id: phones
                        }
                    }],
                    must_not: [],
                    should: [],
                },
            },
            size: "10000",
        },
    };
    const result = await elasticsearch.search(query);
    const data = result.body.hits.hits.map((m) => m._source);
    return data;
};


module.exports = {

    deleteSims: async (
        user,
        sims,
        created_at,
    ) => {
        const collection_name = getCollectionName(user.agency_id);
        const model = mongoose.model(collection_name, simsBoardSchema);
        const existed = await model
            .find({
                sim: {
                    $in: sims
                },
                sell_status: {
                    $ne: 3
                },
            })
            .select({
                _id: 1,
                sim: 1,
                agency_id: 1
            })
            .then((m) => m.map((n) => n.toJSON()));
        await removeSale(existed, created_at);
        await model.deleteMany({
            sim: {
                $in: existed.map((x) => x["sim"])
            }
        });
        return;
    },

    doDeleteSimsJob: async (
        user,
        index_gte,
        index_lt,
        created_at,
    ) => {
        const collection_name = getCollectionName(user.agency_id);
        const model = mongoose.model(collection_name, simsBoardSchema);
        const existed = await model
            .find({
                sim_status: {
                    $ne: 1
                },
                sell_status: {
                    $ne: 3
                },
            })
            .select({
                _id: 1,
                sim: 1,
                agency_id: 1
            })
            .limit(index_lt - index_gte)
            .then((m) => m.map((n) => n.toJSON()));
        await removeSale(existed, created_at);
        await model.deleteMany({
            sim: {
                $in: existed.map((x) => x["sim"])
            }
        });
        return;
    },

    doChangeSaledSimsJob: async (
        user,
        index_gte,
        index_lt,
        request_id,
        created_at,
        is_admin = false
    ) => {
        const collection_name = getCollectionName(user.agency_id);
        const model = mongoose.model(collection_name, simsBoardSchema);
        const existed = await model
            .find({})
            .limit(index_lt - index_gte)
            .then((m) => m.map((n) => n.toJSON()));
        await changeSaledSimES(existed);
        const writes = existed.map((item) => {
            return {
                updateOne: {
                    filter: {
                        _id: item._id,
                    },
                    update: {
                        $set: {
                            sell_status: 4,
                            sim_status: 4,
                            updated_at: created_at,
                        },
                        $push: {
                            logs: {
                                $each: [
                                    item["sell_status"] !== 2 && {
                                        type: "CHANGE_SELLED_STATUS",
                                        request_id,
                                        from_sell_status: item["sell_status"],
                                        to_sell_status: 4,
                                        date: created_at,
                                        user: user.user_id,
                                        is_admin,
                                    },
                                    item["sim_status"] !== 1 && {
                                        type: "CHANGE_SIM_STATUS",
                                        request_id,
                                        from_sim_status: item["sim_status"],
                                        to_sim_status: 4,
                                        date: created_at,
                                        user: user.user_id,
                                        is_admin,
                                    },
                                ].filter(Boolean),
                            },
                        },
                    },
                },
            };
        });
        const result = writes.length && (await model.bulkWrite(_.flatten(writes)));
        return result;
    },

    changeSaledSim: async (
        user,
        sims,
        request_id,
        created_at,
        is_admin = false
    ) => {
        const collection_name = getCollectionName(user.agency_id);
        const model = mongoose.model(collection_name, simsBoardSchema);

        const existed = await model
            .find({
                sim: {
                    $in: sims
                },
                sell_status: 1,
            })
            .then((m) => m.map((n) => n.toJSON()));

        if (existed.length > 0) {
            await changeSaledSimES(existed);
            const writes = await Promise.all(
                existed.map(async (item) => {
                    const keyCache = crypto
                        .createHash("md5")
                        .update(item["sim"])
                        .digest("hex");
                    await delMemcache(keyCache);
                    return {
                        updateOne: {
                            filter: {
                                _id: item._id,
                            },
                            update: {
                                $set: {
                                    sell_status: 4,
                                    sim_status: 4,
                                    updated_at: created_at,
                                    sim_hold_interval_in_seconds: null,
                                    sim_hold_expired_at: null,
                                    customer: null,
                                },
                                $push: {
                                    logs: {
                                        $each: [
                                            item["sim_status"] !== 1 && {
                                                type: "CHANGE_SELLED_STATUS",
                                                request_id,
                                                from_sell_status: item["sim_status"],
                                                to_sell_status: 4,
                                                date: created_at,
                                                user: user.user_id,
                                                is_admin,
                                            },
                                            item["sim_status"] !== 1 && {
                                                type: "CHANGE_SIM_STATUS",
                                                request_id,
                                                from_sim_status: item["sim_status"],
                                                to_sim_status: 4,
                                                date: created_at,
                                                user: user.user_id,
                                                is_admin,
                                            },
                                        ].filter(Boolean),
                                    },
                                },
                            },
                        },
                    };
                })
            );
            const result =
                writes.length && (await model.bulkWrite(_.flatten(writes)));
            return result;
        } else {
            return 0;
        }
    },
}