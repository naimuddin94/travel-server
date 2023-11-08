const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000;
const app = express();

//middleware
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(cookieParser());

// middleware
const verifyUser = async (req, res, next) => {
  const token = req?.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: "forbidden" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized" });
    }
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster01.lvlchtb.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.log);

// create services database
const serviceCollection = client
  .db("travlogDB")
  .collection("serviceCollection");

// create booking database
const bookingCollection = client
  .db("travlogDB")
  .collection("bookingCollection");

// create token for user
app.post("/api/v1/jwt", async (req, res) => {
  const email = req.body;
  const token = jwt.sign(email, process.env.ACCESS_TOKEN, { expiresIn: "1h" });
  res
    .cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" ? true : false,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    })
    .send({ message: "success" });
});

// user logout handle
app.post("/api/v1/logout", (req, res) => {
  const email = req.body;
  res
    .clearCookie("token", {
      maxAge: 0,
      secure: process.env.NODE_ENV === "production" ? true : false,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    })
    .send({ message: "cleared" });
});

// get all services from database
app.get("/api/v1/services", async (req, res) => {
  try {
    const result = await serviceCollection.find().toArray();
    res.send(result);
  } catch (error) {
    res.send({ message: "error while fetched data" });
  }
});

// search services by user requested values
app.get("/api/v1/search", async (req, res) => {
  const value = req.query.value;
  try {
    const query = {
      serviceName: { $regex: value, $options: "i" },
    };
    const results = await serviceCollection.find(query).toArray();
    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error.message });
  }
});

// get services by user email
app.get("/api/v1/user-services", verifyUser, async (req, res) => {
  const email = req.query.email;
  if (email !== req.user.email) {
    return res.status(401).send({ message: "unauthorized" });
  }

  const query = { providerEmail: email };
  const result = await serviceCollection.find(query).toArray();
  res.send(result);
});

// get single service by id
app.get("/api/v1/services/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const result = await serviceCollection.findOne({ _id: new ObjectId(id) });
    res.send(result);
  } catch (error) {
    res.send({message: error.message});
  }
});

// save services to database
app.post("/api/v1/services", async (req, res) => {
  try {
    const service = req.body;
    const result = await serviceCollection.insertOne(service);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// save book service to database
app.post("/api/v1/booking",verifyUser, async (req, res) => {
  try {
    const service = req.body;
    const result = await bookingCollection.insertOne(service);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// get booking services by user email
app.get("/api/v1/booking", verifyUser, async (req, res) => {
  const email = req.query.email;
  if (email !== req.user.email) {
    return res.status(401).send({ message: "unauthorized" });
  }

  const query = {};
  if (email) {
    query.userEmail = email;
  }
  const result = await bookingCollection.find(query).toArray();
  res.send(result);
});

// get booking services by provider email
app.get("/api/v1/orders", verifyUser, async (req, res) => {
  const email = req.query.email;
  if (email !== req.user.email) {
    return res.status(401).send({ message: "unauthorized" });
  }

  const query = { providerEmail: email };
  const result = await bookingCollection.find(query).toArray();
  res.send(result);
});

// update service by id
app.put("/api/v1/services/:id", verifyUser, async (req, res) => {
  const id = req.params.id;
  const email = req.query.email;
  if (email !== req.user.email) {
    return res.status(401).send({ message: "unauthorized" });
  }

  const { area, newPrice, newPhoto, newName, newDescription } = req.body;
  const filter = { _id: new ObjectId(id) };
  const options = { upsert: true };

  const updateService = {
    $set: {
      serviceName: newName,
      image: newPhoto,
      tourArea: area,
      price: newPrice,
      description: newDescription,
    },
  };

  const result = await serviceCollection.updateOne(
    filter,
    updateService,
    options
  );

  res.send(result);
});

// update status by id
app.put("/api/v1/update-status/:id", verifyUser, async (req, res) => {
  const id = req.params.id;
  const email = req.query.email;
  if (email !== req.user.email) {
    return res.status(401).send({ message: "unauthorized" });
  }

  const status = req.query.status;
  const filter = { _id: new ObjectId(id) };
  const options = { upsert: true };

  const updateStatus = {
    $set: {
      status,
    },
  };
  const result = await bookingCollection.updateOne(
    filter,
    updateStatus,
    options
  );

  res.send(result);
});

// delete service from database
app.delete("/api/v1/services/:id", verifyUser, async (req, res) => {
  const id = req.params.id;
  const email = req.query.email;
  if (email !== req.user.email) {
    return res.status(401).send({ message: "unauthorized" });
  }

  const result = await serviceCollection.deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});

app.get("/", async (req, res) => {
  res.send("Welcome to the travlog server");
});

app.listen(port, () => {
  console.log(`server listening on port ${port}`);
});
