import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { SpatialService } from './spatial';

@Global()
@Module({
  providers: [PrismaService, SpatialService],
  exports: [PrismaService, SpatialService],
})
export class PlatformModule {}
