

// ============================================
// src/hooks/useForm.js
// ============================================
import { useState, useCallback } from 'react';

export const useForm = (initialValues = {}, validationSchema = {}) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // Manejar cambio en inputs
  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setValues((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }, []);

  // Manejar blur (cuando se sale de un campo)
  const handleBlur = useCallback((e) => {
    const { name } = e.target;
    setTouched((prev) => ({
      ...prev,
      [name]: true,
    }));
  }, []);

  // Validar un campo específico
  const validateField = useCallback(
    (name, value) => {
      const validator = validationSchema[name];
      if (!validator) return null;

      try {
        validator(value);
        return null;
      } catch (error) {
        return error.message;
      }
    },
    [validationSchema]
  );

  // Validar todos los campos
  const validate = useCallback(() => {
    const newErrors = {};
    Object.keys(validationSchema).forEach((key) => {
      const error = validateField(key, values[key]);
      if (error) newErrors[key] = error;
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [values, validationSchema, validateField]);

  // Reset form
  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    validate,
    reset,
    setValues,
    setErrors,
  };
};

