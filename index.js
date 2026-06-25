const express = require('express');
const dotenv = require('dotenv');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
dotenv.config();
const cors = require('cors');
const app = express();
const port = process.env.PORT;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;

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
    const DB = client.db(process.env.DB_NAME);
    const doctorsCollection = DB.collection('doctors');

    // Doctor data post
    app.post('/doctors', async (req, res) => {
      const doctorData = req.body;
      doctorData.verificationStatus = 'pending';
      doctorData.createdAt = new Date();
      const result = await doctorsCollection.insertOne(doctorData);
      res.send(result);
    });

    // Doctor Data get
    app.get('/doctors/:email', async (req, res) => {
      const email = req.params.email;
      const result = await doctorsCollection.findOne({ email: email, });
      res.send(result);
    })

    // Doctor profile update
    app.patch('/doctors/:id', async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: updatedData,
      };

      const result = await doctorsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Doctors verified and search get
    app.get('/doctors', async (req, res) => {
      const { search = '', specialty = '', sortPrice = '' } = req.query;

      // Search by name + filter by specialty
      const query = {
        verificationStatus: 'verified',
      };

      if (search) {
        query.doctorName = {
          $regex: search,
          $options: 'i',
        };
      }

      if (specialty) {
        query.specialty = specialty;
      }

      // Sort by price
      let sortOption = {};

      if (sortPrice === 'lowToHigh') {
        sortOption = { fee: 1 };
      }

      if (sortPrice === 'highToLow') {
        sortOption = { fee: -1 };
      }

      const doctors = await doctorsCollection
        .find(query)
        .sort(sortOption)
        .toArray();

      res.send(doctors);
    });

    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db('admin').command({ ping: 1 });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!',
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
