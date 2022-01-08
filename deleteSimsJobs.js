


const mongoose = require("mongoose");
const _ = require("lodash");

const jobSchema = new mongoose.Schema({
    request_id: String,
    index_gte: Number,
    index_lt: Number,
    sim_ids: [String],
    total_sims_count: Number,
    user: mongoose.Schema.Types.Mixed,
    created_at: {
        type: Date,
        default: () => new Date()
    },
    error: mongoose.Schema.Types.Mixed,
    status: {
        type: String,
        default: "PENDING"
    },
    change_saled_sim: Boolean,
});

const simsJobModel = mongoose.model("delete_sims_jobs", jobSchema);


module.exports = {
    doneJob: async (_id) => {
        await simsJobModel.updateOne({
            _id
        }, {
            $set: {
                status: "DONE"
            }
        });
    },

    runningJob: async (_id) => {
        await simsJobModel.updateOne({
            _id
        }, {
            $set: {
                status: "RUNNING"
            }
        });
    },

    failedJob: async (_id, error) => {
        await simsJobModel.updateOne({
            _id
        }, {
            $set: {
                status: "FAILED",
                error
            }
        });
    },


}