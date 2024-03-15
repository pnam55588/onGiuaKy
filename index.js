const express = require("express")
const PORT = 3000
const app = express()
const AWS = require("aws-sdk")
require('dotenv').config()
const multer = require("multer")


// app.use(express.urlencoded({ extended: true }))
app.use(express.static("./view"))

app.set('view engine', "ejs")
app.set("views", "./views")

AWS.config.update({
    region: process.env.REGION,
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY
})

const S3 = new AWS.S3()
const db = new AWS.DynamoDB.DocumentClient()

const bucketName = process.env.S3_BUCKET_NAME
const tableName = process.env.DYNAMODB_TABLE_NAME


const storage = multer.memoryStorage();

const imageFilter = (req, file, cb) => {
    if (file.mimetype.split('/')[0] === 'image') {
        cb(null, true);
    } else {
        cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE'), false);
    }
}
const upload = multer({ storage: storage, fileFilter: imageFilter, limits: { fileSize: 1024 * 1024 * 2 } });

const uploadImage = async(file) => {
    const params = {
        Bucket: bucketName,
        Key: `${Date.now()}`,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: "public-read"
    }
    return await S3.upload(params).promise()
}


app.get("/", async(req, res) => {
    const params = {
        TableName: tableName
    }
    const data = await db.scan(params).promise()
    res.render("index", { data: data.Items, error: req.query.error })
});


app.post("/save", upload.single("image"), async(req,res)=>{
    const id = Number(req.body.id)
    if(id === 0) return res.redirect("/?error=Invalid ID")
    const name = req.body.name || "No name"
    const amount = Number(req.body.amount)
    if(!amount || amount <0) return res.redirect("/?error=Invalid amount")

    const file = req.file
    const image = file? await uploadImage(file) : null

    const params = {
        TableName: tableName,
        Item: {
            id,
            name,
            amount,
            image: image? image.Location : null
        }
    }
    await db.put(params).promise()
    return res.redirect("/")
})

app.get("/delete/:id", async(req, res) => {
    const id = Number(req.params.id)
    const params = {
        TableName: tableName,
        Key: { id }
    }
    await db.delete(params).promise()
    return res.redirect("/")
})


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})