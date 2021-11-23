// import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';

const eip = new aws.ec2.Eip('satisfactory-eip', {
  vpc: true,
});

exports.publicIp = eip.publicIp;
