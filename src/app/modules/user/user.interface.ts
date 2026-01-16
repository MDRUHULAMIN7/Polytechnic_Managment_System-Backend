
export type TUser = {
    id : string;
    password : string;
    needsPasswordChange : boolean;
    role : 'admin' | 'student' | 'instructor';
    status?: "active" | "blocked";
    isDeleted : boolean;

}