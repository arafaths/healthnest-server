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
    const appointmentsCollection = DB.collection('appointments');
    const reviewsCollection = DB.collection('reviews');
    const prescriptionsCollection = DB.collection('prescriptions');
    const usersCollection = DB.collection('user');

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
      const result = await doctorsCollection.findOne({ email: email });
      res.send(result);
    });

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

    // Book appinment Doctor details
    app.get('/doctor/:id', async (req, res) => {
      const id = req.params.id;

      const result = await doctorsCollection.findOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

    // Appointments data Post
    app.post('/appointments', async (req, res) => {
      try {
        const appointment = req.body;

        const result = await appointmentsCollection.insertOne({
          ...appointment,
          createdAt: new Date(),
        });

        res.status(201).send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({
          success: false,
          message: 'Failed to create appointment',
        });
      }
    });

    // Patient Dashbord overview
    app.get('/patient/overview/:email', async (req, res) => {
      const { email } = req.params;

      const appointments = await appointmentsCollection
        .find({ patientEmail: email })
        .toArray();

      const upcomingAppointments = appointments.filter(
        appointment => appointment.appointmentStatus === 'pending',
      );

      const totalPayments = appointments
        .filter(item => item.paymentStatus === 'paid')
        .reduce((sum, item) => sum + Number(item.fee || 0), 0);

      res.send({
        upcomingAppointments: upcomingAppointments.length,
        appointmentHistory: appointments.length,
        totalPayments,
      });
    });

    // Upcoming Appointments
    app.get('/patient/upcoming-appointments/:email', async (req, res) => {
      const { email } = req.params;

      const appointments = await appointmentsCollection
        .find({
          patientEmail: email,
          appointmentStatus: 'pending',
        })
        .sort({ appointmentDate: 1 })
        .toArray();

      res.send(appointments);
    });

    // Add review api
    app.post('/reviews', async (req, res) => {
      const review = req.body;

      review.createdAt = new Date();

      const result = await reviewsCollection.insertOne(review);

      res.send(result);
    });

    // Patient reviews
    app.get('/reviews/patient/:email', async (req, res) => {
      const { email } = req.params;

      const result = await reviewsCollection
        .find({ patientEmail: email })
        .sort({ createdAt: -1 })
        .toArray();

      res.send(result);
    });

    // Delete review
    app.delete('/reviews/:id', async (req, res) => {
      const { id } = req.params;

      const result = await reviewsCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

    // update review
    app.patch('/reviews/:id', async (req, res) => {
      const { id } = req.params;

      const { rating, comment } = req.body;

      const result = await reviewsCollection.updateOne(
        {
          _id: new ObjectId(id),
        },
        {
          $set: {
            rating,
            comment,
          },
        },
      );

      res.send(result);
    });

    // Update user profile
    app.patch('/users/:email', async (req, res) => {
      try {
        const { email } = req.params;
        const updatedData = req.body;

        const result = await DB.collection('user').updateOne(
          { email },
          {
            $set: {
              name: updatedData.name,
              image: updatedData.image,
              phone: updatedData.phone,
              gender: updatedData.gender,
              dob: updatedData.dob,
              address: updatedData.address,
            },
          },
        );

        res.send(result);
      } catch (error) {
        console.log(error);
        res.status(500).send({
          success: false,
          message: 'Failed to update profile',
        });
      }
    });

    // Doctor Dashboard Overview
    app.get('/doctor/overview/:email', async (req, res) => {
      const { email } = req.params;

      try {
        // doctor info
        const doctor = await doctorsCollection.findOne({ email });

        if (!doctor) {
          return res.status(404).send({ message: 'Doctor not found' });
        }

        // doctor appointments
        const appointments = await appointmentsCollection
          .find({
            doctorId: doctor._id.toString(),
          })
          .toArray();

        // doctor reviews
        const reviews = await reviewsCollection
          .find({
            doctorId: doctor._id.toString(),
          })
          .toArray();

        const totalPatients = new Set(
          appointments.map(item => item.patientEmail),
        ).size;

        const today = new Date().toISOString().split('T')[0];

        const todayAppointments = appointments.filter(
          item => item.appointmentDate === today,
        ).length;

        const totalPrescriptions = appointments.filter(
          item => item.prescription,
        ).length;

        const totalEarnings = appointments
          .filter(item => item.paymentStatus === 'paid')
          .reduce((sum, item) => sum + Number(item.fee || 0), 0);

        res.send({
          totalPatients,
          todayAppointments,
          totalReviews: reviews.length,
          totalPrescriptions,
          totalEarnings,
          recentReviews: reviews
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5),
        });
      } catch (err) {
        console.log(err);
        res.status(500).send({
          message: 'Server Error',
        });
      }
    });

    // Doctor Dashbord appointment get
    app.get('/doctor/appointments/:email', async (req, res) => {
      const { email } = req.params;

      const result = await appointmentsCollection
        .find({
          doctorEmail: email,
        })
        .sort({ createdAt: -1 })
        .toArray();

      res.send(result);
    });

    // Doctor Dashbord appointment Accept API
    app.patch('/appointments/accept/:id', async (req, res) => {
      const { id } = req.params;

      const result = await appointmentsCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            appointmentStatus: 'accepted',
          },
        },
      );

      res.send(result);
    });

    // Doctor Dashbord appointment Reject API
    app.patch('/appointments/reject/:id', async (req, res) => {
      const { id } = req.params;

      const result = await appointmentsCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            appointmentStatus: 'rejected',
          },
        },
      );

      res.send(result);
    });

    // Doctor Dashbord appointment Complet API
    app.patch('/appointments/complete/:id', async (req, res) => {
      const { id } = req.params;

      const result = await appointmentsCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            appointmentStatus: 'completed',
          },
        },
      );

      res.send(result);
    });

    // Doctor Prescription Create API
    app.post('/prescriptions', async (req, res) => {
      const data = req.body;

      data.createdAt = new Date();

      const result = await prescriptionsCollection.insertOne(data);

      res.send(result);
    });

    // Doctor Prescription get
    app.get('/doctor/prescriptions/:email', async (req, res) => {
      const { email } = req.params;

      const result = await prescriptionsCollection
        .find({
          doctorEmail: email,
        })
        .sort({ createdAt: -1 })
        .toArray();

      res.send(result);
    });

    // Doctor Appointments completed get
    app.get('/doctor/patients/:email', async (req, res) => {
      const { email } = req.params;

      const appointments = await appointmentsCollection
        .find({
          doctorEmail: email,
          appointmentStatus: 'completed',
        })
        .toArray();

      const patients = [
        ...new Map(
          appointments.map(item => [
            item.patientEmail,
            {
              patientName: item.patientName,
              patientEmail: item.patientEmail,
              patientImage: item.patientImage,
            },
          ]),
        ).values(),
      ];

      res.send(patients);
    });

    // Doctor Presctiptions Update
    app.patch('/prescriptions/:id', async (req, res) => {
      const { id } = req.params;

      const result = await prescriptionsCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: req.body,
        },
      );

      res.send(result);
    });

    // Admin Ecosystem Analytics API
    app.get('/admin/ecosystem-analytics', async (req, res) => {
      try {
        const totalDoctors = await doctorsCollection.countDocuments({
          verificationStatus: 'verified',
        });

        const totalPatients = await DB.collection('user').countDocuments({
          role: 'patient',
        });

        const totalAppointments = await appointmentsCollection.countDocuments();

        const totalRevenue = await appointmentsCollection
          .find({
            paymentStatus: 'paid',
          })
          .toArray();

        const revenue = totalRevenue.reduce(
          (sum, item) => sum + Number(item.fee || 0),
          0,
        );

        // ---------- Doctor Performance ----------
        const topDoctors = await reviewsCollection
          .aggregate([
            {
              $group: {
                _id: '$doctorEmail',
                rating: { $avg: '$rating' },
              },
            },
            {
              $sort: { rating: -1 },
            },
            {
              $limit: 5,
            },
          ])
          .toArray();

        const doctorPerformance = [];

        for (const doctor of topDoctors) {
          const info = await doctorsCollection.findOne({
            doctorEmail: doctor._id,
          });

          doctorPerformance.push({
            name: info?.doctorName || 'Unknown',
            rating: Number(doctor.rating.toFixed(1)),
          });
          console.log(info);
        }

        // ---------- Monthly Overview ----------
        const monthly = await appointmentsCollection
          .aggregate([
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: '%Y-%m',
                    date: '$createdAt',
                  },
                },
                appointments: {
                  $sum: 1,
                },
              },
            },
            {
              $sort: {
                _id: 1,
              },
            },
          ])
          .toArray();

        const platformOverview = monthly.map(item => ({
          month: item._id,
          appointments: item.appointments,
        }));

        res.send({
          stats: {
            totalDoctors,
            totalPatients,
            totalAppointments,
            totalRevenue: revenue,
          },
          doctorPerformance,
          platformOverview,
        });
      } catch (err) {
        console.log(err);

        res.status(500).send({
          message: 'Server Error',
        });
      }
    });

    // Admin Manage User Accounts get API
    app.get('/admin/users', async (req, res) => {
      try {
        const users = await usersCollection
          .aggregate([
            {
              $addFields: {
                rolePriority: {
                  $cond: [
                    { $eq: ['$role', 'admin'] },
                    0, // Admin first
                    1, // Doctor + Patient together
                  ],
                },
              },
            },
            {
              $sort: {
                rolePriority: 1,
                createdAt: -1,
              },
            },
            {
              $project: {
                rolePriority: 0,
              },
            },
          ])
          .toArray();

        res.send(users);
      } catch (err) {
        res.status(500).send({ message: 'Server Error' });
      }
    });

    // Admin Manage User Accounts delete API
    app.delete('/admin/users/:id', async (req, res) => {
      try {
        const { id } = req.params;

        const result = await usersCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).send({
            success: false,
            message: 'User not found',
          });
        }

        res.send({
          success: true,
          message: 'User deleted successfully',
        });
      } catch (err) {
        console.log(err);

        res.status(500).send({
          success: false,
          message: 'Server Error',
        });
      }
    });

    // Admin Manage User Accounts Suspend\Active API
    app.patch('/admin/users/:id/suspend', async (req, res) => {
      try {
        const { id } = req.params;

        const user = await usersCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!user) {
          return res.status(404).send({
            success: false,
            message: 'User not found',
          });
        }

        const newStatus = user.status === 'Suspended' ? 'Active' : 'Suspended';

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status: newStatus,
            },
          },
        );

        res.send({
          success: true,
          message: `User ${newStatus.toLowerCase()} successfully`,
          status: newStatus,
        });
      } catch (err) {
        console.log(err);
        res.status(500).send({
          success: false,
          message: 'Server Error',
        });
      }
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
