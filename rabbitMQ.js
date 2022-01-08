
  
const amqp = require('amqplib/callback_api')
let ch = null

exports.publishToQueue = async (queue_name, data) => {
    amqp.connect('amqp://admin:Appsim2020@103.141.144.199:5672', (err, connection) => {
        try {
            connection.createChannel(async (err, chanel) => {
                ch = chanel
                if (err) {
                    console.log( err)
                }
           await ch.sendToQueue(queue_name, Buffer.from(data), {
                    presistent: true
                })
            })
        } catch (error) {
            console.log(error)
        }

    })

}
process.on('exit', (code) => {
    ch.close()
    console.log('close channel')
})