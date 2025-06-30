import React, { useState } from 'react';
import { useMotors } from '../context/MotorsContext';
import MotorDetailCard from '../components/MotorDetailCard';
import './Dashboard.css';

export default function Dashboard() {
  const { motors, addMotor, removeMotor } = useMotors();
  const [newMotorName, setNewMotorName] = useState('');
  const [newMotorLocation, setNewMotorLocation] = useState('');
  const [newMotorIdInput, setNewMotorIdInput] = useState(''); // New state for motor ID input
  const [showAddMotorForm, setShowAddMotorForm] = useState(false);

  // Handle adding new motor
  const handleAddMotor = (e) => {
    e.preventDefault();

    // Basic validation
    if (newMotorName.trim() === '' || newMotorLocation.trim() === '' || newMotorIdInput.trim() === '') {
      console.log('Please enter motor name, location, and a unique Motor ID.');
      // In a real app, you'd show a custom modal or toast notification here.
      return;
    }

    // Check if a motor with this ID already exists
    if (motors.some(motor => motor.id === newMotorIdInput.trim())) {
      console.warn(`Motor with ID "${newMotorIdInput.trim()}" already exists. Please choose a different ID.`);
      // You might want to show this error more prominently in the UI
      return;
    }

    // Call addMotor from context with the provided ID, name, and location.
    // MotorsContext will now use this ID for MQTT subscriptions.
    addMotor(newMotorIdInput.trim(), newMotorName.trim(), newMotorLocation.trim());

    console.log(`Motor added with ID: ${newMotorIdInput.trim()}, Name: ${newMotorName.trim()}`);

    // Clear form fields
    setNewMotorIdInput('');
    setNewMotorName('');
    setNewMotorLocation('');
    setShowAddMotorForm(false);
  };

  // 'motors' array itself now contains the most up-to-date live data
  // from MQTT messages, updated in MotorsContext.
  const motorsForDisplay = motors.map(motor => {
    return {
      ...motor,
      displayLastUpdated: motor.lastUpdated ? motor.lastUpdated.toLocaleTimeString() : 'N/A',
    };
  });

  return (
    <div className="dashboard-container">
      <div className="dashboard-main-content">
        <div className="dashboard-header">
          <h1>Motors Dashboard</h1>
          <div className="dashboard-controls">
            <button
              onClick={() => setShowAddMotorForm(!showAddMotorForm)}
              className="dashboard-add-button"
            >
              {showAddMotorForm ? 'Close Form' : 'Add New Motor'}
            </button>
          </div>
        </div>

        {showAddMotorForm && (
          <form className="add-motor-form" onSubmit={handleAddMotor}>
            {/* New Input Field for Motor ID */}
            <input
              type="text"
              placeholder="Unique Motor ID (e.g., HVAC-001)"
              value={newMotorIdInput}
              onChange={(e) => setNewMotorIdInput(e.target.value)}
              className="dashboard-input"
              required
            />
            <input
              type="text"
              placeholder="Motor Name (e.g., Main Fan Motor)"
              value={newMotorName}
              onChange={(e) => setNewMotorName(e.target.value)}
              className="dashboard-input"
              required
            />
            <input
              type="text"
              placeholder="Location (e.g., Assembly Line A)"
              value={newMotorLocation}
              onChange={(e) => setNewMotorLocation(e.target.value)}
              className="dashboard-input"
              required
            />
            <button type="submit" className="dashboard-submit-button">
              Add Motor
            </button>
          </form>
        )}

        <h2 className="section-title">All Motors Overview</h2>
        <div className="dashboard-grid">
          {motors.length === 0 ? (
            <p className="no-motors-message">
              No motors added yet. Click "Add New Motor" to get started.
            </p>
          ) : (
            motorsForDisplay.map((motor) => (
              <MotorDetailCard
                key={motor.id}
                motor={motor}
                onDelete={() => removeMotor(motor.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
