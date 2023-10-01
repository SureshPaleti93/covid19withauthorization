const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "COPYCAT", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//CREATE USER API-1

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  getDbUserQuery = `
        SELECT *
        FROM user
        WHERE username = '${username}';
    `;
  const dbUser = await db.get(getDbUserQuery);
  console.log(dbUser);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isValidPassword = await bcrypt.compare(password, dbUser.password);
    if (isValidPassword === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "COPYCAT");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//GET LIST OF STATES API-2

app.get("/states/", authenticateToken, async (request, response) => {
  getstatesQuery = `
        SELECT 
            state_id as stateId,
            state_name as stateName,
            population
        FROM state
        ORDER BY state_id;
    `;
  const statesArray = await db.all(getstatesQuery);
  response.send(statesArray);
});
module.exports = app;

//GET STATE BASED ON ID API-3

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  getStateQuery = `
        SELECT 
            state_id as stateId,
            state_name as stateName,
            population
        FROM state
        WHERE state_id = ${stateId};
    `;
  const stateData = await db.get(getStateQuery);
  response.send(stateData);
});
module.exports = app;

//CREATE DISTRICT API-4
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postDistrictQuery = `
        INSERT INTO district(district_name, state_id, cases, cured, active, deaths)
        VALUES
        (
            '${districtName}',
            ${stateId},
            ${cases},
            ${cured},
            ${active},
            ${deaths}
        );
    `;
  await db.run(postDistrictQuery);
  response.send("District Successfully Added");
});
module.exports = app;

// GET DISTRICT API-5

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    getDistrictQuery = `
        SELECT
            district_id as districtId,
            district_name as districtName,
            state_id as stateId,
            cases,
            cured,
            active,
            deaths
        FROM 
            district
        WHERE
            district_id = ${districtId};
    `;
    const districtData = await db.get(getDistrictQuery);
    response.send(districtData);
  }
);
module.exports = app;

//DELETE DISTRICT API-6

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    deleteDistrictQuery = `
        DELETE FROM district
        WHERE district_id = ${districtId};
    `;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);
module.exports = app;

//UPDATE DISTRICT API-7

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `
        UPDATE
            district
        SET
            district_name = '${districtName}',
            state_id = ${stateId},
            cases = ${cases},
            cured = ${cured},
            active = ${active},
            deaths = ${deaths};
    `;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);
module.exports = app;

//GET TOTAL DATA OF A STATE API-8

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    getStateData = `
        SELECT 
            sum(cases) as totalCases,
            sum(cured) as totalCured,
            sum(active) as totalActive,
            sum(deaths) as totalDeaths 
        FROM 
            state NATURAL JOIN district
        WHERE
            state.state_id = ${stateId};
    `;
    const stateData = await db.all(getStateData);
    response.send(stateData);
  }
);
module.exports = app;
