const mongoose = require("mongoose");
const _ = require("lodash")


const jobSchema = new mongoose.Schema({
    is_admin: { type: Boolean, default: false },
    request_id: String,
    index_gte: Number,
    index_lt: Number,
    sim_ids: [String],
    total_sims_count: Number,
    sell_status: Number,
    user: mongoose.Schema.Types.Mixed,
    created_at: { type: Date, default: () => new Date() },
    error: mongoose.Schema.Types.Mixed,
    status: { type: String, default: "PENDING" }, // PENDING | RUNNING | DONE | CANCELLED,
    remove_sale: Boolean,
    retry: { type: Number, default: 0 },
    updated_at: Date,
});
const simsJobModel = mongoose.model("post_for_sale_job_debug", jobSchema);

const addJobBySimIds = async (
    sim_ids,
    sell_status,
    request_id,
    user,
    created_at,
    is_admin,
    remove_sale = false
) => {
    if (sell_status === 1 && !request_id) {
        throw new Error("Request id is required when posting for sale");
    }

    await simsJobModel.create({
        is_admin,
        sim_ids,
        total_sims_count: sim_ids.length,
        sell_status,
        request_id,
        user,
        created_at,
        status: remove_sale == true ?
            RemoveSimEnum.WAITING_JOB : sell_status === 1 ?
            RemoveSimEnum.WAITING_CONFIRM : RemoveSimEnum.PENDING,
        remove_sale,
    });
    return;
};



module.exports = {
    jobSchema,
    createPostForSaleJobBySimIds: async (
        user,
        sim_ids,
        sell_status,
        request_id,
        created_at,
        is_admin,
        remove_sale = false
    ) => {
        await addJobBySimIds(
            sim_ids,
            sell_status,
            request_id,
            user,
            created_at,
            is_admin,
            remove_sale
        );
        return;
    },
}