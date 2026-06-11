import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { LogIn, Key, User as UserIcon } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { User } from '../types';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (user) {
    return <Navigate to={user.role === 'admin' ? "/inventory" : "/pos"} replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      // Format the username to email for Firebase Auth
      const formattedEmail = username.includes('@') ? username : `${username.toLowerCase().trim()}@pieldivina.com`;

      // Authenticate with Firebase Auth using formatted email
      const userCredential = await signInWithEmailAndPassword(auth, formattedEmail, password);

      // Fetch custom user data from Firestore
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data() as Omit<User, 'id'>;
        const loggedInUser: User = { ...userData, id: userCredential.user.uid };

        login(loggedInUser);

        if (loggedInUser.role === 'admin') {
          navigate('/inventory');
        } else {
          navigate('/pos');
        }
      } else {
        setError('Usuario autenticado pero sin registro en la base de datos de usuarios.');
      }
    } catch (err: unknown) {
      console.error(err);
      const firebaseError = err as { code?: string; message?: string };
      if (firebaseError.code === 'auth/invalid-credential' || firebaseError.code === 'auth/user-not-found' || firebaseError.code === 'auth/wrong-password') {
        setError('Usuario o contraseña incorrectos.');
      } else {
        setError(`Ocurrió un error al iniciar sesión: ${firebaseError.message || firebaseError.code || 'Desconocido'}`);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-lg border border-gray-100">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            Piel Divina
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Ingresa tus credenciales para continuar
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm font-medium text-center">
              {error}
            </div>
          )}

          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Usuario o Correo</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="focus:ring-teal-500 focus:border-teal-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-3 border"
                  placeholder="Ej. ana"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-teal-500 focus:border-teal-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-3 border"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors"
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                <LogIn className="h-5 w-5 text-teal-500 group-hover:text-teal-400" />
              </span>
              Iniciar Sesión
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
