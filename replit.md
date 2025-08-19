# MindDouble App

## Overview
MindDouble is a wellness productivity application designed for a minimalist, emotionally intelligent, and mobile-first experience. It aims to enhance productivity through advanced progress tracking, featuring Apple Watch-style calendar rings and celebratory animations for task completion. The project's vision is to provide a seamless, intuitive tool for users to manage their tasks, habits, and goals while fostering a positive emotional connection to their progress.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
MindDouble employs a client-server architecture.

### Core Architectural Decisions:
- **Client-Server Model**: Separates frontend (React) and backend (Express.js) for scalability and maintainability.
- **Data Storage**: Initially file-based (JSON) for rapid development, with a planned migration to PostgreSQL for robust data management.
- **Authentication**: Firebase Authentication handles user identity, with server-side validation for security.
- **AI Integration**: Leverages OpenAI for intelligent features like task time estimation, mood reflections, and day planning.
- **Hybrid Architecture**: Implements a phased migration strategy from legacy item management to a new recurring_instances architecture, ensuring backward compatibility and a seamless transition. This includes hybrid access control, verification flows, and data reading/writing.
- **Per-Occurrence Completion**: Recurring items track completion per occurrence rather than marking the entire series as complete, enabling accurate streak tracking and flexible scheduling.
- **Community Features**: Supports shared tasks, manual verification workflows by community members, and role-based access control (RBAC) for community management.
- **Timezone Awareness**: Comprehensive timezone infrastructure ensures accurate task scheduling and progress tracking for a global user base.
- **Performance Optimization**: Focuses on database query consolidation, intelligent server-side caching, and optimized data models (e.g., instance-based calculations for metrics) for scalable performance.
- **Observability**: Implements structured logging for monitoring, performance tracking, and security auditing.
- **UI/UX Philosophy**: Prioritizes a minimalist aesthetic, mobile-first design, and teen-friendly celebratory elements (e.g., progress rings, completion animations) while maintaining clear visual hierarchy and interactive elements. Uses TailwindCSS for styling and ShadCN UI for components.

### Technical Implementations:
- **Frontend**: React, Vite (build tool), TailwindCSS, ShadCN UI, React Query (data fetching), Wouter (routing).
- **Backend**: Express.js, Firebase Admin SDK, OpenAI SDK, Drizzle ORM (for PostgreSQL interaction).
- **Database Schema**: Core entities include Users, Moods, and Items (Tasks, Habits, Goals, Projects) with a focus on granular attributes and a new `recurring_instances` table for recurrence management.
- **Data Flow**: Authentication involves client-side Firebase auth, ID token receipt, and server-side validation. API requests are authenticated via middleware before processing.
- **Security**: Strict user data isolation, robust authentication middleware, and regular vulnerability patching (e.g., Multer, Vite).
- **Deployment**: Configured for Replit with Node.js 20 and PostgreSQL 16, using npm scripts for development and production builds.

## External Dependencies
- **Firebase Authentication**: User authentication and identity management.
- **Firebase Admin SDK**: Server-side verification of Firebase authentication tokens.
- **OpenAI**: AI-powered features (task estimation, mood reflection, day planning).
- **PostgreSQL**: Primary database for persistent storage (future migration target, currently using file-based storage).
- **Drizzle ORM**: Object-Relational Mapper for database interactions.
- **Express.js**: Backend web application framework.
- **React**: Frontend UI library.
- **Vite**: Frontend build tool and bundler.
- **TailwindCSS**: Utility-first CSS framework.
- **ShadCN UI**: Component library.
- **Radix UI**: Low-level UI primitives.
- **React Query**: Data fetching and state management library for the frontend.
- **Wouter**: Lightweight client-side router.
- **Lucide React**: Icon library.
- **Winston**: Structured logging for the backend.
- **Multer**: Middleware for handling `multipart/form-data`, primarily for file uploads (e.g., photo verification).
- **Nanoid**: For generating unique IDs.