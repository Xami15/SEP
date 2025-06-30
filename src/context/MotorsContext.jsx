// src/context/MotorsContext.jsx
import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import mqtt from 'mqtt'; // Import MQTT client

const MotorsContext = createContext();

export const useMotors = () => useContext(MotorsContext);

export const MotorsProvider = ({ children }) => {
  // State for the list of motors, initialized from localStorage
  const [motors, setMotors] = useState(() => {
    const savedMotors = localStorage.getItem('motors');
    if (savedMotors) {
      const parsedMotors = JSON.parse(savedMotors);
      return parsedMotors.map((motor) => ({
        ...motor,
        lastUpdated: motor.lastUpdated ? new Date(motor.lastUpdated) : null,
        temperature: typeof motor.temperature === 'number' ? motor.temperature : null,
        vibration: typeof motor.vibration === 'number' ? motor.vibration : null,
        confidence: typeof motor.confidence === 'number' ? motor.confidence : 0,
      }));
    }
    return [];
  });

  // State for historical data logs, initialized from localStorage
  const [historyData, setHistoryData] = useState(() => {
    const saved = localStorage.getItem('historyData');
    return saved ? JSON.parse(saved) : [];
  });

  // State to hold live temperature, vibration, and timestamp data for each motor for charts
  const [liveMotorDataHistory, setLiveMotorDataHistory] = useState({});

  // Use a ref to keep track of current MQTT client and its connection status
  const mqttClientRef = useRef(null);
  const [mqttConnected, setMqttConnected] = useState(false);
  const subscribedTopicsRef = useRef(new Set());

  // Save motors to localStorage whenever the motors state changes
  useEffect(() => {
    localStorage.setItem(
      'motors',
      JSON.stringify(
        motors.map((motor) => ({
          ...motor,
          lastUpdated: motor.lastUpdated instanceof Date ? motor.lastUpdated.toISOString() : motor.lastUpdated,
        }))
      )
    );
  }, [motors]);

  // Save historyData to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('historyData', JSON.stringify(historyData));
  }, [historyData]);


  // Primary useEffect for MQTT connection and dynamic subscriptions
  useEffect(() => {
    if (!mqttClientRef.current) {
      const client = mqtt.connect("wss://test.mosquitto.org:8081");
      mqttClientRef.current = client;

      client.on("connect", () => {
        console.log("MotorsContext: Connected to MQTT broker");
        setMqttConnected(true);
        motors.forEach(motor => {
          const topic = `motors/${motor.id}/data`;
          if (!subscribedTopicsRef.current.has(topic)) {
            client.subscribe(topic, (err) => {
              if (err) {
                console.error(`MotorsContext: Failed to subscribe to ${topic}:`, err);
              } else {
                console.log(`MotorsContext: Subscribed to: ${topic}`);
                subscribedTopicsRef.current.add(topic);
              }
            });
          }
        });
      });

      client.on("message", (topic, message) => {
        try {
          const data = JSON.parse(message.toString());
          const motorId = data.motor_id;
          if (!motorId) {
            console.warn("MotorsContext: MQTT message missing motor_id in topic:", topic, "data:", data);
            return;
          }

          const newTemperature = parseFloat(data.temperature);
          const newVibration = parseFloat(data.vibration);
          const newTimestamp = data.timestamp ? new Date(data.timestamp * 1000) : new Date();
          const newStatus = data.status || 'Unknown';
          const newConfidence = data.confidence || 0;

          setMotors(prevMotors => {
            return prevMotors.map(motor => {
              if (motor.id === motorId) {
                return {
                  ...motor,
                  temperature: newTemperature,
                  vibration: newVibration,
                  status: newStatus,
                  confidence: newConfidence,
                  lastUpdated: newTimestamp,
                };
              }
              return motor;
            });
          });

          setLiveMotorDataHistory((prevHistory) => {
            const updatedHistory = { ...prevHistory };
            if (!updatedHistory[motorId]) {
              updatedHistory[motorId] = { temperature: [], vibration: [], timestamps: [] };
            }

            const MAX_HISTORY_POINTS = 60;
            updatedHistory[motorId].temperature = [
              ...updatedHistory[motorId].temperature.slice(-(MAX_HISTORY_POINTS - 1)),
              newTemperature,
            ];
            updatedHistory[motorId].vibration = [
              ...updatedHistory[motorId].vibration.slice(-(MAX_HISTORY_POINTS - 1)),
              newVibration,
            ];
            updatedHistory[motorId].timestamps = [
              ...updatedHistory[motorId].timestamps.slice(-(MAX_HISTORY_POINTS - 1)),
              newTimestamp.toLocaleTimeString(),
            ];
            return updatedHistory;
          });

          const motorNameForLog = motors.find(m => m.id === motorId)?.name || motorId;
          setHistoryData(prevLogs => [
            ...prevLogs,
            {
              id: `log-${Date.now()}-${motorId}`,
              timestamp: newTimestamp.toISOString(),
              motor: motorNameForLog,
              status: newStatus,
              confidence: newConfidence,
              temperature: newTemperature,
              vibration: newVibration,
            },
          ]);

        } catch (err) {
          console.error("MotorsContext: Error parsing MQTT message:", err, "Topic:", topic, "Message:", message.toString());
        }
      });

      client.on("error", (err) => {
        console.error("MotorsContext: MQTT client error:", err);
        setMqttConnected(false);
      });

      client.on("close", () => {
        console.log("MotorsContext: MQTT client disconnected.");
        setMqttConnected(false);
      });
    }

    const client = mqttClientRef.current;
    if (!client) return;

    const currentMotorTopics = new Set(motors.map(m => `motors/${m.id}/data`));
    const topicsToRemoveFromSubscriptionSet = new Set();

    subscribedTopicsRef.current.forEach(topic => {
      if (!currentMotorTopics.has(topic)) {
        if (client.connected) {
          client.unsubscribe(topic, (err) => {
            if (err) console.error(`MotorsContext: Failed to unsubscribe from ${topic}:`, err);
            else console.log(`MotorsContext: Unsubscribed from: ${topic}`);
          });
        }
        topicsToRemoveFromSubscriptionSet.add(topic);
      }
    });

    topicsToRemoveFromSubscriptionSet.forEach(topic => subscribedTopicsRef.current.delete(topic));

    motors.forEach(motor => {
      const topic = `motors/${motor.id}/data`;
      if (!subscribedTopicsRef.current.has(topic)) {
        if (client.connected) {
          client.subscribe(topic, (err) => {
            if (err) {
              console.error(`MotorsContext: Failed to subscribe to ${topic}:`, err);
            } else {
              console.log(`MotorsContext: Subscribed to: ${topic}`);
              subscribedTopicsRef.current.add(topic);
            }
          });
        }
      }
    });

    return () => {
      if (mqttClientRef.current && mqttClientRef.current.connected) {
        mqttClientRef.current.end();
        mqttClientRef.current = null;
        subscribedTopicsRef.current.clear();
        console.log("MotorsContext: MQTT client disconnected on unmount.");
      }
    };
  }, [motors, mqttConnected]);

  // MODIFIED: addMotor now accepts motorId, newMotorName, newMotorLocation
  const addMotor = useCallback((newMotorId, newMotorName, newMotorLocation) => {
    setMotors((prevMotors) => {
      // Check for duplicate name (optional, but good for UX)
      if (prevMotors.some(motor => motor.name === newMotorName.trim())) {
        console.warn(`Motor with name "${newMotorName}" already exists.`);
        return prevMotors;
      }
      // Check for duplicate ID (Crucial for linking to hardware)
      if (prevMotors.some(motor => motor.id === newMotorId.trim())) {
          console.warn(`Motor with ID "${newMotorId}" already exists. Cannot add duplicate.`);
          return prevMotors; // Don't add if ID already exists
      }

      const newMotor = {
        id: newMotorId.trim(), // Use the provided ID
        name: newMotorName.trim(),
        location: newMotorLocation.trim(),
        temperature: null,
        vibration: null,
        status: 'Disconnected',
        confidence: 0,
        lastUpdated: null,
      };
      return [...prevMotors, newMotor];
    });
  }, []); // Dependencies are empty as arguments are used directly

  const removeMotor = useCallback((motorId) => {
    setMotors((prevMotors) => prevMotors.filter((motor) => motor.id !== motorId));
    setLiveMotorDataHistory((prevHistory) => {
      const updated = { ...prevHistory };
      delete updated[motorId];
      return updated;
    });

    const topic = `motors/${motorId}/data`;
    if (mqttClientRef.current && mqttClientRef.current.connected && subscribedTopicsRef.current.has(topic)) {
      mqttClientRef.current.unsubscribe(topic, (err) => {
        if (err) console.error(`MotorsContext: Failed to unsubscribe from ${topic}:`, err);
        else {
          console.log(`MotorsContext: Explicitly unsubscribed from: ${topic}`);
          subscribedTopicsRef.current.delete(topic);
        }
      });
    }
  }, []);

  const value = {
    motors,
    historyData,
    liveMotorDataHistory,
    addMotor,
    removeMotor,
    mqttConnected,
  };

  return <MotorsContext.Provider value={value}>{children}</MotorsContext.Provider>;
};
