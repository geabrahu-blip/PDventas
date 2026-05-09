import { render, screen, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as firebaseAuth from 'firebase/auth';
import * as firebaseFirestore from 'firebase/firestore';

// Mock dependencies
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(),
  signOut: vi.fn(),
  getAuth: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  getFirestore: vi.fn(),
}));

vi.mock('../services/firebase', () => ({
  auth: {},
  db: {},
}));

// Dummy component to test useAuth
const TestComponent = () => {
  const { user, login, logout, isAdmin, loading } = useAuth();

  return (
    <div>
      <div data-testid="loading">{loading.toString()}</div>
      <div data-testid="user">{user ? user.name : 'No User'}</div>
      <div data-testid="is-admin">{isAdmin.toString()}</div>
      <button onClick={() => login({ id: '1', name: 'Test User', role: 'vendedor' as any, email: 'test@test.com'})}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws an error if useAuth is used outside of AuthProvider', () => {
    // Suppress console.error for this expected error test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestComponent />)).toThrow('useAuth must be used within an AuthProvider');
    consoleSpy.mockRestore();
  });

  it('provides initial loading state', () => {
    // Simulate onAuthStateChanged not firing immediately
    vi.mocked(firebaseAuth.onAuthStateChanged).mockImplementation(() => () => {});

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Initial state is loading: true, so children are not rendered yet
    expect(screen.queryByTestId('loading')).toBeNull();
  });

  it('sets user to null when no firebaseUser is provided', async () => {
    let authCallback: (user: any) => void = () => {};
    vi.mocked(firebaseAuth.onAuthStateChanged).mockImplementation((_auth, callback: any) => {
      authCallback = callback;
      return () => {};
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    act(() => {
      authCallback(null);
    });

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
      expect(screen.getByTestId('user')).toHaveTextContent('No User');
      expect(screen.getByTestId('is-admin')).toHaveTextContent('false');
    });
  });

  it('fetches user data when authenticated and sets user', async () => {
    let authCallback: (user: any) => void = () => {};
    vi.mocked(firebaseAuth.onAuthStateChanged).mockImplementation((_auth, callback: any) => {
      authCallback = callback;
      return () => {};
    });

    const mockUserData = { name: 'Admin User', role: 'admin' };
    vi.mocked(firebaseFirestore.doc).mockReturnValue({} as any);
    vi.mocked(firebaseFirestore.getDoc).mockResolvedValue({
      exists: () => true,
      data: () => mockUserData,
    } as any);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await act(async () => {
      await authCallback({ uid: '123' });
    });

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
      expect(screen.getByTestId('user')).toHaveTextContent('Admin User');
      expect(screen.getByTestId('is-admin')).toHaveTextContent('true');
    });
  });

  it('handles user not found in firestore', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    let authCallback: (user: any) => void = () => {};
    vi.mocked(firebaseAuth.onAuthStateChanged).mockImplementation((_auth, callback: any) => {
      authCallback = callback;
      return () => {};
    });

    vi.mocked(firebaseFirestore.getDoc).mockResolvedValue({
      exists: () => false,
    } as any);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await act(async () => {
      await authCallback({ uid: '123' });
    });

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('No User');
      expect(consoleSpy).toHaveBeenCalledWith('User document not found in Firestore!');
    });

    consoleSpy.mockRestore();
  });

  it('handles getDoc error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    let authCallback: (user: any) => void = () => {};
    vi.mocked(firebaseAuth.onAuthStateChanged).mockImplementation((_auth, callback: any) => {
      authCallback = callback;
      return () => {};
    });

    const mockError = new Error('Network error');
    vi.mocked(firebaseFirestore.getDoc).mockRejectedValue(mockError);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await act(async () => {
      await authCallback({ uid: '123' });
    });

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('No User');
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching user data:', mockError);
    });

    consoleSpy.mockRestore();
  });

  it('updates state correctly on manual login', async () => {
    let authCallback: (user: any) => void = () => {};
    vi.mocked(firebaseAuth.onAuthStateChanged).mockImplementation((_auth, callback: any) => {
      authCallback = callback;
      return () => {};
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    act(() => {
      authCallback(null);
    });

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    act(() => {
      screen.getByText('Login').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('Test User');
      expect(screen.getByTestId('is-admin')).toHaveTextContent('false');
    });
  });

  it('calls firebase signout and updates state on logout', async () => {
    let authCallback: (user: any) => void = () => {};
    vi.mocked(firebaseAuth.onAuthStateChanged).mockImplementation((_auth, callback: any) => {
      authCallback = callback;
      return () => {};
    });

    vi.mocked(firebaseAuth.signOut).mockResolvedValue();

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    act(() => {
      authCallback(null); // finish loading
    });

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    // Login manually first
    act(() => {
      screen.getByText('Login').click();
    });

    expect(screen.getByTestId('user')).toHaveTextContent('Test User');

    // Logout
    await act(async () => {
      screen.getByText('Logout').click();
    });

    await waitFor(() => {
      expect(firebaseAuth.signOut).toHaveBeenCalled();
      expect(screen.getByTestId('user')).toHaveTextContent('No User');
    });
  });

  it('handles logout error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    let authCallback: (user: any) => void = () => {};
    vi.mocked(firebaseAuth.onAuthStateChanged).mockImplementation((_auth, callback: any) => {
      authCallback = callback;
      return () => {};
    });

    const mockError = new Error('Logout failed');
    vi.mocked(firebaseAuth.signOut).mockRejectedValue(mockError);

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    act(() => {
      authCallback(null);
    });

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    await act(async () => {
      screen.getByText('Logout').click();
    });

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error signing out:', mockError);
    });

    consoleSpy.mockRestore();
  });
});