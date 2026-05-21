const express = require("express");
const { ObjectId } = require("mongodb");
const { MongoClient, ServerApiVersion } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
const app = express();
const dotenv = require("dotenv");
dotenv.config();

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);

const cors = require("cors");
const port = process.env.PORT || 8080;

app.use(cors());

const uri = process.env.MONGOBD_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const logger = (req, res, next) => {
  console.log(`${req.method} | ${req.url}`);
  next();
};

const varifyToken = async (req, res, next) => {
  const authorization = req.headers;
  const token = authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Unauthorize" });
  }

  try {
    const JWKS = createRemoteJWKSet(
      new URL("http://localhost:3000/api/auth/jwks"),
    );
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (error) {
    console.error("Token validation failed:", error);
    return res.status(401).json({ message: "Unauthorize" });
  }
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });

    const db = client.db("studynookdb");
    const roomCollection = db.collection("rooms");
    const bookingCollection = db.collection("bookings");

    app.get("/rooms", async (req, res) => {
      const { search } = req.query;

      let cursor;
      if (search) {
        curson = roomCollection.find({ room_name: { $eq: "" } }).toArray();
        res.send({});
      } else {
        cursor = roomCollection.find();
      }

      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/latest", async (req, res) => {
      const cursor = roomCollection.find().limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.patch("/mybookings/:roomId", varifyToken, async (req, res) => {
      const { roomId } = req.params;
      const bookingData = req.body;

      const room = await roomCollection.findOne({ _id: new ObjectId(roomId) });

      if (!room) {
        res.status(404).json({ message: "Room not found " });
      }
      await roomCollection.updateOne(
        { _id: new ObjectId(roomId) },
        {
          $inc: { bookCount: 1 },
          $set: {
            lastBookedAt: new Date(),
          },
        },
      );

      const result = await bookingCollection.insertOne({
        ...bookingData,
        bookAt: new Date(),
      });

      res.send(result);
    });

    app.get("/rooms/:roomId", logger, varifyToken, async (req, res) => {
      const { roomId } = req.params;
      console.log(roomId);
      const query = { _id: new ObjectId(roomId) };

      const result = await roomCollection.findOne(query);
      res.send(result);
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
