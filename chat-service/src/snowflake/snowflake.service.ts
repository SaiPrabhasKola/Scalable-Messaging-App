import { Injectable } from '@nestjs/common';
import SnowflakeId from 'snowflake-id'


@Injectable()
export class SnowflakeService {
    private snowflake: any

    onModuleInit() {
        const machineId = Number(process.env.CHAT_PORT || 3000) % 1024
        this.snowflake = new SnowflakeId({
            mid: machineId
        })
        console.log(this.snowflake)
        console.log(this.snowflake.generate().toString())

    }
    generate() {
        return this.snowflake.generate().toString()
    }

}
