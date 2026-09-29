import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { ZodSerializerDto, ZodSerializerInterceptor } from 'nestjs-zod';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UserIdParamDto } from './dto/user-id-param.dto';
import { UserPageResponseDto, UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

// Not registered globally in AppModule, so @ZodSerializerDto would be a no-op without this.
@UseInterceptors(ZodSerializerInterceptor)
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ZodSerializerDto(UserResponseDto)
  create(@Body() body: CreateUserDto) {
    return this.users.create(body);
  }

  @Get(':id')
  @ZodSerializerDto(UserResponseDto)
  findOne(@Param() { id }: UserIdParamDto, @CurrentUser() actor: AuthUser) {
    return this.users.findVisibleTo(id, actor);
  }

  @Roles('admin')
  @Get()
  @ZodSerializerDto(UserPageResponseDto)
  list(@Query() { cursor, limit }: ListUsersQueryDto) {
    return this.users.list(cursor, limit);
  }

  @Roles('admin')
  @Audit('user.soft_delete')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param() { id }: UserIdParamDto): Promise<void> {
    return this.users.softDelete(id);
  }
}
