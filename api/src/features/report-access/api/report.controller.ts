import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../shared/auth';
import { ChannelMemberGuard } from '../../../entities/user';
import { FundRepository, type PublicFund } from '../../../entities/fund';
import { privateReport, type PrivateReport } from '../../../entities/report';

@Controller('report')
export class ReportController {
  constructor(private readonly fund: FundRepository) {}

  @Get('public')
  getPublicReport(): PublicFund {
    return this.fund.getPublicFund();
  }

  @Get('secret')
  @UseGuards(JwtAuthGuard, ChannelMemberGuard)
  getSecretReport(): PrivateReport {
    return privateReport;
  }
}
