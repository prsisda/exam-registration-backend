const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");
const crypto = require("crypto");

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const EXAMS_TABLE = process.env.EXAMS_TABLE;
const REGISTRATIONS_TABLE = process.env.REGISTRATIONS_TABLE;
const HOST = "http://localhost:5173";

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": HOST,
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
};

exports.handler = async (event) => {
  const method = event?.httpMethod || event?.requestContext?.http?.method;
  const path = event?.path || event?.rawPath || "";

  if (method === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  try {
    if (method === "GET" && path === "/exams") {
      const result = await ddb.send(
        new ScanCommand({
          TableName: EXAMS_TABLE,
        })
      );

      return response(200, result.Items || []);
    }

    if (method === "GET" && path === "/registrations") {
      const result = await ddb.send(
        new ScanCommand({
          TableName: REGISTRATIONS_TABLE,
        })
      );

      return response(200, result.Items || []);
    }

    if (method === "POST" && path === "/registrations") {
      const body = JSON.parse(event.body || "{}");
      const examId = body.examId;

      if (!examId) {
        return response(400, { message: "examId is required" });
      }

      const registration = {
        registrationId: crypto.randomUUID(),
        examId,
        createdAt: new Date().toISOString(),
      };

      await ddb.send(
        new PutCommand({
          TableName: REGISTRATIONS_TABLE,
          Item: registration,
        })
      );

      return response(201, registration);
    }

    if (method === "DELETE" && path.startsWith("/registrations/")) {
      const examId = decodeURIComponent(path.split("/").pop());

      const registrationsResult = await ddb.send(
        new ScanCommand({
          TableName: REGISTRATIONS_TABLE,
        })
      );

      const items = registrationsResult.Items || [];
      const registrationToDelete = items.find((item) => item.examId === examId);

      if (!registrationToDelete) {
        return response(404, { message: "Registration not found" });
      }

      await ddb.send(
        new DeleteCommand({
          TableName: REGISTRATIONS_TABLE,
          Key: {
            registrationId: registrationToDelete.registrationId,
          },
        })
      );

      return response(200, {
        message: "Registration deleted",
        registrationId: registrationToDelete.registrationId,
        examId,
      });
    }

    return response(404, { message: "Route not found" });
  } catch (error) {
    return response(500, {
      message: "Internal server error",
      error: error.message,
    });
  }
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body),
  };
}