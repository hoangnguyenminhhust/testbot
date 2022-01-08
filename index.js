const {
    runningJob,
    doneJob,
    failedJob
} = require("./deleteSimsJobs");
const {
    deleteSims,
    doDeleteSimsJob,
    doChangeSaledSimsJob,
    changeSaledSim
} = require("./simBoard");


const executeNextJob = async (job) => {
    const {
        _id,
        index_gte,
        index_lt,
        user,
        created_at,
        sim_ids,
        request_id,
        change_saled_sim
    } = job; // JOB from rabbitMQ
    try {
        console.log("RUNNING with agency", user.agency_id)
        if (change_saled_sim) {
            if (sim_ids) {
                await changeSaledSim(user, sim_ids, request_id, created_at, false);
            } else {
                await doChangeSaledSimsJob(user, index_gte, index_lt, request_id, created_at, false);
            }
        } else {
            if (sim_ids) {
                await deleteSims(user, sim_ids, created_at);
            } else {
                await doDeleteSimsJob(user, index_gte, index_lt, created_at);
            }
        }
        await doneJob(_id);
    } catch (error) {
        await failedJob(_id, `DELETE_JOB-----ERROR:${error}-----JOB:${_id}-----USER:${user}-----ERORRSTACK:${error.stack}`);
    }
}

module.exports = {
    executeNextJob
}