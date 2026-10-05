import { IsEmail, IsString, MinLength } from 'class-validator';
import { TokenPairDto } from './token.dto.js';

export class AdminLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export class AdminRoleDto {
  id!: string;
  key!: string;
  name!: string;
  permissions!: string[];
}

export class AdminProfileDto {
  id!: string;
  email!: string;
  name!: string;
  role!: AdminRoleDto;
}

export class AdminAuthResultDto {
  admin!: AdminProfileDto;
  tokens!: TokenPairDto;
}
