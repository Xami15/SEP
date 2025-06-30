// src/pages/ResetPassword.jsx
import React, { useState, useEffect } from "react"; // Keep useEffect imported even if not directly used for now
import { useNavigate, useSearchParams } from "react-router-dom";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Get oobCode from the URL query parameters
  const oobCode = searchParams.get("oobCode");

  // ADD THIS useEffect BLOCK
  useEffect(() => {
    console.log("ResetPassword component loaded. oobCode:", oobCode);
    if (!oobCode) {
      setError("No reset code found in URL. Please use the link from your email.");
      // You might also want to redirect here if oobCode is consistently missing
      // setTimeout(() => navigate("/login"), 5000);
    }
  }, [oobCode]); // This dependency array ensures it runs when oobCode is available


  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!oobCode) { // This check is also done in useEffect, but good to have here too
      setError("Invalid or missing reset code.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=AIzaSyCS_s-7PEcmA2CowNI545t2xEv79rMSU2c",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            oobCode: oobCode,
            newPassword: password,
          }),
        }
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || "Password reset failed");
      }

      setMessage("Password reset successful. Redirecting to login...");
      setTimeout(() => navigate("/login"), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f5f5f5",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "#fff",
          padding: "40px",
          borderRadius: "10px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          width: "100%",
          maxWidth: "400px",
          textAlign: "center",
        }}
      >
        <h2 style={{ marginBottom: "20px" }}>Reset Password</h2>

        <input
          type="password"
          placeholder="New Password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: "12px",
            marginBottom: "16px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            fontSize: "16px",
          }}
        />

        <input
          type="password"
          placeholder="Confirm New Password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          style={{
            width: "100%",
            padding: "12px",
            marginBottom: "16px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            fontSize: "16px",
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: "#001f4d",
            color: "#fff",
            fontWeight: "bold",
            fontSize: "16px",
            border: "none",
            borderRadius: "8px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Resetting..." : "Reset Password"}
        </button>

        {message && (
          <p style={{ marginTop: "16px", color: "green", fontWeight: "bold" }}>
            {message}
          </p>
        )}

        {error && (
          <p style={{ marginTop: "16px", color: "red", fontWeight: "bold" }}>
            {error}
          </p>
        )}
      </form>
    </div>
  );
}