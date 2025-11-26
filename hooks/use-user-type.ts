"use client";

import { UserType } from '@/types';
import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';

async function fetchUserType(): Promise<UserType | null> {
  const response = await fetch('/api/user-type');
  
  if (!response.ok) {
    throw new Error('Failed to fetch user type');
  }
  const data = await response.json();
  return data;
}

export function useUserType() {
  const { userId, isLoaded } = useAuth();

  return useQuery<UserType | null>({
    queryKey: ['userType', userId],
    queryFn: fetchUserType,
    retry: 1,
    enabled: isLoaded && !!userId, // Only run query if userId exists
  });
}