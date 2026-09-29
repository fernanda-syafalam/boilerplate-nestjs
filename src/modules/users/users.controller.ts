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
} from '@nestjs/common';
import { ZodSerializerDto } from 'nestjs-zod';
import { z } from 'zod';
import { Audit } from '../../common/decorators/audit.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

const CursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

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
  findOne(@Param('id') id: string) {
    return this.users.findById(id);
  }

  @Get()
  async list(@Query() query: unknown) {
    const { cursor, limit } = CursorQuerySchema.parse(query);
    const page = await this.users.list(cursor, limit);
    return {
      items: page.items.map(
        ({ passwordHash: _passwordHash, deletedAt: _deletedAt, ...rest }) => rest,
      ),
      nextCursor: page.nextCursor,
    };
  }

  @Roles('admin')
  @Audit('user.soft_delete')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.users.softDelete(id);
  }
}
