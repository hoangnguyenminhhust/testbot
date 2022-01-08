const {
    Schema,
} = require('mongoose');

const simsBoardSchema = new Schema({
    // _id: String,
    agency_id: String,
    sim: {
        type: String,
        index: {
            unique: true
        }
    },
    sim_full: String,
    sim_serial: String,
    sim_status: {
        type: Number
    },
    sim_hold_interval_in_seconds: Number,
    sim_hold_expired_at: {
        type: Date
    },
    sim_type: Number,
    telco: String,
    total_score: Number,
    total_digit: Number,
    sim_package: String,
    category: [Number],
    active_date: Date,
    provider_price: Number,
    sell_price: Number,
    sell_status: {
        type: Number
    }, // 0: ko ban, 1: dang ban
    discount_rate: Number,
    wholesale_price: Number,
    position: String,
    note: String,
    customer_id: String,
    customer: Schema.Types.Mixed,
    created_at: {
        type: Date,
        default: () => new Date()
    },
    for_sale_at: {
        type: Date
    },
    updated_at: {
        type: Date
    },
    request_id: String,
    logs: Schema.Types.Mixed,
    pt: Number,
    duplication: {
        type: String
    },
    is_changed_telco: {
        type: Boolean
    },
    contract: String,
});
simsBoardSchema.index({
    sim: 1,
    sell_status: 1,
    sim_status: 1,
    created_at: 1,
    duplication: 1
});

module.exports = {
    simsBoardSchema
};